import {
  classSessionCalendarQuerySchema,
  createAttendanceRequestSchema,
  createClassNoteRequestSchema,
  createClassSessionRequestSchema,
  updateAttendanceRequestSchema,
  updateClassNoteRequestSchema,
  updateClassSessionRequestSchema,
  type AttendanceListResponse,
  type AttendanceResponse,
  type ClassNoteListResponse,
  type ClassNoteResponse,
  type ClassSessionCalendarResponse,
  type ClassSessionListResponse,
  type ClassSessionResponse,
  type PermissionAction,
  type SessionUser,
} from '@academia/shared';
import { Router } from 'express';
import type { AcademyBusinessConfig } from '../../domain/academy/academy-config.js';
import {
  AttendanceAlreadyExistsError,
  AttendanceForbiddenError,
  AttendanceNotFoundError,
  AttendanceValidationError,
  createAttendance,
  listAttendanceForClassSession,
  updateAttendance,
  type AttendanceStore,
  type AttendanceWriteActor,
} from '../../domain/attendance/attendance-service.js';
import {
  hasPermission,
  type PermissionGrantStore,
} from '../../domain/authorization/has-permission.js';
import {
  ClassNoteForbiddenError,
  ClassNoteNotFoundError,
  ClassNoteValidationError,
  createClassNote,
  deleteClassNote,
  listClassNotes,
  updateClassNote,
  type ClassNoteStore,
} from '../../domain/class-notes/class-note-service.js';
import {
  ClassSessionConflictError,
  ClassSessionForbiddenError,
  ClassSessionNotFoundError,
  ClassSessionValidationError,
  createClassSession,
  deleteClassSession,
  getClassSession,
  listClassSessions,
  listClassSessionsForCalendar,
  updateClassSession,
  type ClassSessionReadScope,
  type ClassSessionStore,
  type ClassSessionWriteActor,
} from '../../domain/classes/class-session-service.js';
import type { StudentStore } from '../../domain/students/student-service.js';
import type { TeacherStore } from '../../domain/teachers/teacher-service.js';
import {
  assertMeetingStartNotInPast,
  GoogleMeetApiError,
  GoogleMeetCreateError,
  GoogleMeetNotConfiguredError,
  GoogleMeetPastStartError,
  type GoogleMeetService,
} from '../../domain/classes/google-meet-service.js';
import {
  assertZoomMeetingStartNotInPast,
  ZoomMeetingApiError,
  ZoomMeetingAuthError,
  ZoomMeetingNetworkError,
  ZoomMeetingNotConfiguredError,
  ZoomMeetingPastStartError,
  type ZoomMeetingService,
} from '../../domain/classes/zoom-meeting-service.js';
import { runAutoChargeForClassSession } from '../../domain/finance/auto-charge-runner.js';
import type { FinanceStore } from '../../domain/finance/finance-store.js';
import type { NotificationAudienceResolver } from '../../domain/notifications/notification-audience.js';
import { notifyClassMeetingLink } from '../../domain/notifications/notification-hooks.js';
import type { NotificationPublisher } from '../../domain/notifications/notification-types.js';
import { logger } from '../../lib/logger.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface ClassSessionsDependencies {
  authenticate: AuthenticateOptions;
  classSessions: ClassSessionStore;
  attendances: AttendanceStore;
  classNotes: ClassNoteStore;
  teachers: TeacherStore;
  students: StudentStore;
  academy: AcademyBusinessConfig;
  permissionGrants: PermissionGrantStore;
  /** Optional: auto-charge after ClassSession create (ONE_TO_ONE). */
  finance?: FinanceStore;
  notifications?: NotificationPublisher;
  audience?: NotificationAudienceResolver;
  googleMeet?: GoogleMeetService;
  zoomMeeting?: ZoomMeetingService;
}

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

/**
 * Administrative callers with classes.read → unrestricted.
 * TEACHER / STUDENT without that grant → scoped to Group.teacherId / Enrollment.
 * Session identity only — never query/body teacherId or studentId.
 */
async function resolveClassSessionReadScope(
  grants: PermissionGrantStore,
  user: SessionUser,
  teachers: TeacherStore,
  students: StudentStore,
): Promise<ClassSessionReadScope | null> {
  if (await hasPermission(grants, user.role, 'classes', 'read')) {
    return { mode: 'all' };
  }
  if (user.role === 'TEACHER') {
    const teacher = await teachers.findByUserId(user.id);
    if (!teacher) return null;
    return { mode: 'teacher', teacherId: teacher.id };
  }
  if (user.role === 'STUDENT') {
    const student = await students.findByUserId(user.id);
    if (!student) return null;
    return { mode: 'student', studentId: student.id };
  }
  return null;
}

/**
 * Write ownership for ClassSession CRUD and nested Attendance / Notes.
 * Admin path: explicit classes.* grant (or SUPER_ADMIN/DIRECTOR bypass).
 * TEACHER without that grant → Group.teacherId must match.
 * Students never write. Session identity only.
 */
async function resolveClassOwnedWriteActor(
  grants: PermissionGrantStore,
  user: SessionUser,
  teachers: TeacherStore,
  adminAction: Extract<PermissionAction, 'create' | 'update' | 'delete'>,
): Promise<ClassSessionWriteActor | null> {
  if (await hasPermission(grants, user.role, 'classes', adminAction)) {
    return { mode: 'admin' };
  }
  if (user.role === 'TEACHER') {
    const teacher = await teachers.findByUserId(user.id);
    if (!teacher) return null;
    return { mode: 'teacher', teacherId: teacher.id };
  }
  return null;
}

/** Nested Attendance / Notes writes use classes.update as the admin grant. */
async function resolveClassSessionWriteActor(
  grants: PermissionGrantStore,
  user: SessionUser,
  teachers: TeacherStore,
): Promise<AttendanceWriteActor | null> {
  return resolveClassOwnedWriteActor(grants, user, teachers, 'update');
}

async function maybeNotifyMeetingLink(
  notifications: NotificationPublisher | undefined,
  audience: NotificationAudienceResolver | undefined,
  classSession: { id: string; startAt: string; meetingUrl: string | null },
  previousMeetingUrl?: string | null,
): Promise<void> {
  if (!notifications || !audience) return;
  const url = classSession.meetingUrl;
  if (!url) return;
  if (previousMeetingUrl === url) return;
  const recipients = await audience.classSessionRecipients(classSession.id);
  await notifyClassMeetingLink(notifications, {
    recipients,
    startAtIso: classSession.startAt,
    meetingUrl: url,
    classSessionId: classSession.id,
  });
}

async function createGoogleMeetForSession(
  googleMeet: GoogleMeetService | undefined,
  academy: AcademyBusinessConfig,
  classSession: {
    startAt: string;
    endAt: string;
    meetingDescription: string | null;
  },
): Promise<{ meetingUrl: string; eventId: string }> {
  if (!googleMeet?.isConfigured()) {
    throw new BadRequestError(
      'Google Meet is not configured on this server.',
    );
  }
  try {
    return await googleMeet.createMeeting({
      summary: 'Clase Academia',
      description: classSession.meetingDescription ?? '',
      startAtIso: classSession.startAt,
      endAtIso: classSession.endAt,
      timeZone: academy.businessTimezone,
    });
  } catch (error) {
    if (error instanceof GoogleMeetNotConfiguredError) {
      throw new BadRequestError(
        'Google Meet is not configured on this server.',
      );
    }
    if (error instanceof GoogleMeetPastStartError) {
      throw new BadRequestError(
        'Cannot create a Google Meet for a class that starts in the past.',
      );
    }
    if (
      error instanceof GoogleMeetCreateError ||
      error instanceof GoogleMeetApiError
    ) {
      throw new BadRequestError(
        'Could not create a Google Meet link for this class.',
      );
    }
    throw error;
  }
}

/** Best-effort Calendar sync — never fails the local class mutation. */
async function syncGoogleMeetBestEffort(
  googleMeet: GoogleMeetService | undefined,
  action: () => Promise<void>,
  context: Record<string, unknown>,
): Promise<void> {
  if (!googleMeet?.isConfigured()) return;
  try {
    await action();
  } catch (error) {
    logger.warn(
      { err: error, ...context },
      'Google Meet Calendar sync failed (best-effort)',
    );
  }
}

async function createZoomMeetingForSession(
  zoomMeeting: ZoomMeetingService | undefined,
  academy: AcademyBusinessConfig,
  classSession: {
    startAt: string;
    endAt: string;
    meetingDescription: string | null;
  },
): Promise<{ meetingUrl: string; meetingId: string }> {
  if (!zoomMeeting?.isConfigured()) {
    throw new BadRequestError('Zoom is not configured on this server.');
  }
  try {
    return await zoomMeeting.createMeeting({
      topic: 'Clase Academia',
      agenda: classSession.meetingDescription ?? '',
      startAtIso: classSession.startAt,
      endAtIso: classSession.endAt,
      timeZone: academy.businessTimezone,
    });
  } catch (error) {
    if (error instanceof ZoomMeetingNotConfiguredError) {
      throw new BadRequestError('Zoom is not configured on this server.');
    }
    if (error instanceof ZoomMeetingPastStartError) {
      throw new BadRequestError(
        'Cannot create a Zoom meeting for a class that starts in the past.',
      );
    }
    if (
      error instanceof ZoomMeetingAuthError ||
      error instanceof ZoomMeetingNetworkError ||
      error instanceof ZoomMeetingApiError
    ) {
      throw new BadRequestError(
        'Could not create a Zoom meeting for this class.',
      );
    }
    throw error;
  }
}

/** Best-effort Zoom sync — never fails the local class mutation. */
async function syncZoomMeetingBestEffort(
  zoomMeeting: ZoomMeetingService | undefined,
  action: () => Promise<void>,
  context: Record<string, unknown>,
): Promise<void> {
  if (!zoomMeeting?.isConfigured()) return;
  try {
    await action();
  } catch (error) {
    logger.warn(
      { err: error, ...context },
      'Zoom meeting sync failed (best-effort)',
    );
  }
}

export function createClassSessionsRouter({
  authenticate: authOptions,
  classSessions,
  attendances,
  classNotes,
  teachers,
  students,
  academy,
  permissionGrants,
  finance,
  notifications,
  audience,
  googleMeet,
  zoomMeeting,
}: ClassSessionsDependencies): Router {
  const router = Router();

  router.get('/classes', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const scope = await resolveClassSessionReadScope(
          permissionGrants,
          req.user!,
          teachers,
          students,
        );
        if (!scope) {
          throw new ForbiddenError();
        }

        const groupIdRaw = req.query['groupId'];
        const groupId =
          typeof groupIdRaw === 'string' && groupIdRaw.length > 0
            ? groupIdRaw
            : undefined;
        const body: ClassSessionListResponse = {
          classSessions: await listClassSessions(classSessions, {
            groupId,
            scope,
          }),
        };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof ClassSessionValidationError) {
          if (error.message === 'Group not found.') {
            next(new NotFoundError(error.message));
            return;
          }
          next(new BadRequestError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.get(
    '/classes/calendar',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const scope = await resolveClassSessionReadScope(
            permissionGrants,
            req.user!,
            teachers,
            students,
          );
          if (!scope) {
            throw new ForbiddenError();
          }

          const parsed = classSessionCalendarQuerySchema.safeParse({
            from: req.query['from'],
            to: req.query['to'],
          });
          if (!parsed.success) {
            throw new BadRequestError(
              parsed.error.issues[0]?.message ??
                'Valid from and to (YYYY-MM-DD) are required.',
            );
          }
          const body: ClassSessionCalendarResponse =
            await listClassSessionsForCalendar(
              classSessions,
              parsed.data,
              academy,
              scope,
            );
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ClassSessionValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.post('/classes', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const actor = await resolveClassOwnedWriteActor(
          permissionGrants,
          req.user!,
          teachers,
          'create',
        );
        if (!actor) {
          throw new ForbiddenError();
        }

        const parsed = createClassSessionRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError(
            'Valid groupId and startAt (ISO datetime) are required.',
          );
        }
        const {
          createGoogleMeet,
          createZoom,
          meetingUrl: requestedMeetingUrl,
          ...rest
        } = parsed.data;

        // Fail closed before insert for predictable client errors (no orphan).
        if (createGoogleMeet) {
          if (!googleMeet?.isConfigured()) {
            throw new BadRequestError(
              'Google Meet is not configured on this server.',
            );
          }
          try {
            assertMeetingStartNotInPast(rest.startAt);
          } catch (error) {
            if (error instanceof GoogleMeetPastStartError) {
              throw new BadRequestError(
                'Cannot create a Google Meet for a class that starts in the past.',
              );
            }
            throw error;
          }
        }
        if (createZoom) {
          if (!zoomMeeting?.isConfigured()) {
            throw new BadRequestError('Zoom is not configured on this server.');
          }
          try {
            assertZoomMeetingStartNotInPast(rest.startAt);
          } catch (error) {
            if (error instanceof ZoomMeetingPastStartError) {
              throw new BadRequestError(
                'Cannot create a Zoom meeting for a class that starts in the past.',
              );
            }
            throw error;
          }
        }

        let classSession = await createClassSession(
          classSessions,
          {
            ...rest,
            ...(requestedMeetingUrl !== undefined
              ? { meetingUrl: requestedMeetingUrl }
              : {}),
          },
          actor,
        );
        let meetCreationFailed = false;
        let zoomCreationFailed = false;
        if (createGoogleMeet) {
          try {
            const meet = await createGoogleMeetForSession(
              googleMeet,
              academy,
              classSession,
            );
            classSession = await updateClassSession(
              classSessions,
              classSession.id,
              {
                meetingUrl: meet.meetingUrl,
                googleCalendarEventId: meet.eventId,
              },
              actor,
            );
          } catch (error) {
            meetCreationFailed = true;
            logger.warn(
              {
                err: error,
                classSessionId: classSession.id,
                action: 'create',
              },
              'Google Meet create failed after class insert; class kept for retry',
            );
          }
        } else if (createZoom) {
          try {
            const zoom = await createZoomMeetingForSession(
              zoomMeeting,
              academy,
              classSession,
            );
            classSession = await updateClassSession(
              classSessions,
              classSession.id,
              {
                meetingUrl: zoom.meetingUrl,
                zoomMeetingId: zoom.meetingId,
              },
              actor,
            );
          } catch (error) {
            zoomCreationFailed = true;
            logger.warn(
              {
                err: error,
                classSessionId: classSession.id,
                action: 'create',
              },
              'Zoom create failed after class insert; class kept for retry',
            );
          }
        }
        if (finance) {
          await runAutoChargeForClassSession(finance, {
            classSessionId: classSession.id,
            createdByUserId: req.user!.id,
          });
        }
        await maybeNotifyMeetingLink(notifications, audience, classSession);
        const body: ClassSessionResponse = {
          classSession,
          ...(meetCreationFailed ? { meetCreationFailed: true } : {}),
          ...(zoomCreationFailed ? { zoomCreationFailed: true } : {}),
        };
        res.status(201).json(body);
      } catch (error) {
        if (error instanceof ClassSessionForbiddenError) {
          next(new ForbiddenError(error.message));
          return;
        }
        if (error instanceof ClassSessionConflictError) {
          next(new ConflictError(error.message));
          return;
        }
        if (error instanceof ClassSessionValidationError) {
          if (error.message === 'Group not found.') {
            next(new NotFoundError(error.message));
            return;
          }
          next(new BadRequestError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.get('/classes/:id', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const id = pathId(req.params['id']);
        if (!id) throw new BadRequestError('Class session id is required.');

        const scope = await resolveClassSessionReadScope(
          permissionGrants,
          req.user!,
          teachers,
          students,
        );
        if (!scope) {
          throw new ForbiddenError();
        }

        const classSession = await getClassSession(classSessions, id, scope);
        const body: ClassSessionResponse = { classSession };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof ClassSessionNotFoundError) {
          next(new NotFoundError(error.message));
          return;
        }
        if (error instanceof ClassSessionForbiddenError) {
          next(new ForbiddenError(error.message));
          return;
        }
        if (error instanceof ClassSessionValidationError) {
          next(new BadRequestError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.patch('/classes/:id', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const id = pathId(req.params['id']);
        if (!id) throw new BadRequestError('Class session id is required.');

        const actor = await resolveClassOwnedWriteActor(
          permissionGrants,
          req.user!,
          teachers,
          'update',
        );
        if (!actor) {
          throw new ForbiddenError();
        }

        const parsed = updateClassSessionRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError(
            'Provide at least one of startAt, isActive, meetingUrl, meetingDescription, createGoogleMeet, removeGoogleMeet, createZoom, or removeZoom.',
          );
        }
        const {
          createGoogleMeet,
          removeGoogleMeet,
          createZoom,
          removeZoom,
          ...patchInput
        } = parsed.data;
        const existing = await classSessions.findById(id);
        if (!existing) {
          throw new ClassSessionNotFoundError();
        }
        const previousMeetingUrl =
          parsed.data.meetingUrl !== undefined ||
          createGoogleMeet ||
          removeGoogleMeet ||
          createZoom ||
          removeZoom
            ? existing.meetingUrl
            : undefined;

        if (createGoogleMeet && existing.zoomMeetingId) {
          throw new BadRequestError(
            'Remove the Zoom meeting before creating Google Meet.',
          );
        }
        if (createZoom && existing.googleCalendarEventId) {
          throw new BadRequestError(
            'Remove the Google Meet before creating a Zoom meeting.',
          );
        }
        if (
          createGoogleMeet &&
          existing.meetingUrl &&
          !existing.googleCalendarEventId
        ) {
          throw new BadRequestError(
            'Clear the manual meeting URL before creating Google Meet.',
          );
        }
        if (
          createZoom &&
          existing.meetingUrl &&
          !existing.zoomMeetingId
        ) {
          throw new BadRequestError(
            'Clear the manual meeting URL before creating a Zoom meeting.',
          );
        }

        const clearMeetFields =
          removeGoogleMeet === true ||
          (parsed.data.meetingUrl === null &&
            existing.googleCalendarEventId !== null);

        if (clearMeetFields) {
          if (existing.googleCalendarEventId) {
            await syncGoogleMeetBestEffort(
              googleMeet,
              () =>
                googleMeet!.deleteMeeting({
                  eventId: existing.googleCalendarEventId!,
                }),
              { classSessionId: id, action: 'delete' },
            );
          }
          // Clear local Meet link fields (manual URL and/or Calendar-backed Meet).
          // meetingDescription is intentionally left untouched.
          patchInput.meetingUrl = null;
          patchInput.googleCalendarEventId = null;
        }

        const clearZoomFields =
          (removeZoom === true && existing.zoomMeetingId !== null) ||
          (parsed.data.meetingUrl === null &&
            existing.zoomMeetingId !== null);

        if (clearZoomFields) {
          if (existing.zoomMeetingId) {
            await syncZoomMeetingBestEffort(
              zoomMeeting,
              () =>
                zoomMeeting!.deleteMeeting({
                  meetingId: existing.zoomMeetingId!,
                }),
              { classSessionId: id, action: 'delete' },
            );
          }
          // Only clears when a managed Zoom id exists (or meetingUrl null with id).
          // removeZoom with a manual-only URL is a no-op for link fields.
          patchInput.meetingUrl = null;
          patchInput.zoomMeetingId = null;
        }

        let classSession =
          Object.keys(patchInput).length > 0
            ? await updateClassSession(classSessions, id, patchInput, actor)
            : await getClassSession(classSessions, id, { mode: 'all' });

        if (
          createGoogleMeet &&
          !classSession.googleCalendarEventId
        ) {
          const meet = await createGoogleMeetForSession(
            googleMeet,
            academy,
            classSession,
          );
          classSession = await updateClassSession(
            classSessions,
            id,
            {
              meetingUrl: meet.meetingUrl,
              googleCalendarEventId: meet.eventId,
            },
            actor,
          );
        } else if (
          createZoom &&
          !classSession.zoomMeetingId
        ) {
          const zoom = await createZoomMeetingForSession(
            zoomMeeting,
            academy,
            classSession,
          );
          classSession = await updateClassSession(
            classSessions,
            id,
            {
              meetingUrl: zoom.meetingUrl,
              zoomMeetingId: zoom.meetingId,
            },
            actor,
          );
        } else if (
          classSession.googleCalendarEventId &&
          (parsed.data.startAt !== undefined ||
            parsed.data.meetingDescription !== undefined)
        ) {
          const eventId = classSession.googleCalendarEventId;
          await syncGoogleMeetBestEffort(
            googleMeet,
            () =>
              googleMeet!.updateMeeting({
                eventId,
                ...(parsed.data.meetingDescription !== undefined
                  ? {
                      description: classSession.meetingDescription ?? '',
                    }
                  : {}),
                ...(parsed.data.startAt !== undefined
                  ? {
                      startAtIso: classSession.startAt,
                      endAtIso: classSession.endAt,
                      timeZone: academy.businessTimezone,
                    }
                  : {}),
              }),
            { classSessionId: id, action: 'update' },
          );
        } else if (
          classSession.zoomMeetingId &&
          (parsed.data.startAt !== undefined ||
            parsed.data.meetingDescription !== undefined)
        ) {
          const meetingId = classSession.zoomMeetingId;
          await syncZoomMeetingBestEffort(
            zoomMeeting,
            () =>
              zoomMeeting!.updateMeeting({
                meetingId,
                ...(parsed.data.meetingDescription !== undefined
                  ? {
                      agenda: classSession.meetingDescription ?? '',
                    }
                  : {}),
                ...(parsed.data.startAt !== undefined
                  ? {
                      startAtIso: classSession.startAt,
                      endAtIso: classSession.endAt,
                      timeZone: academy.businessTimezone,
                    }
                  : {}),
              }),
            { classSessionId: id, action: 'update' },
          );
        }

        if (parsed.data.isActive === false) {
          if (existing.googleCalendarEventId) {
            await syncGoogleMeetBestEffort(
              googleMeet,
              () =>
                googleMeet!.deleteMeeting({
                  eventId: existing.googleCalendarEventId!,
                }),
              { classSessionId: id, action: 'delete-inactive' },
            );
            if (classSession.googleCalendarEventId) {
              classSession = await updateClassSession(
                classSessions,
                id,
                {
                  meetingUrl: null,
                  googleCalendarEventId: null,
                },
                actor,
              );
            }
          }
          if (existing.zoomMeetingId) {
            await syncZoomMeetingBestEffort(
              zoomMeeting,
              () =>
                zoomMeeting!.deleteMeeting({
                  meetingId: existing.zoomMeetingId!,
                }),
              { classSessionId: id, action: 'delete-inactive' },
            );
            if (classSession.zoomMeetingId) {
              classSession = await updateClassSession(
                classSessions,
                id,
                {
                  meetingUrl: null,
                  zoomMeetingId: null,
                },
                actor,
              );
            }
          }
        }

        await maybeNotifyMeetingLink(
          notifications,
          audience,
          classSession,
          previousMeetingUrl,
        );
        const body: ClassSessionResponse = { classSession };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof ClassSessionNotFoundError) {
          next(new NotFoundError(error.message));
          return;
        }
        if (error instanceof ClassSessionForbiddenError) {
          next(new ForbiddenError(error.message));
          return;
        }
        if (error instanceof ClassSessionConflictError) {
          next(new ConflictError(error.message));
          return;
        }
        if (error instanceof ClassSessionValidationError) {
          next(new BadRequestError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.delete('/classes/:id', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const id = pathId(req.params['id']);
        if (!id) throw new BadRequestError('Class session id is required.');

        const actor = await resolveClassOwnedWriteActor(
          permissionGrants,
          req.user!,
          teachers,
          'delete',
        );
        if (!actor) {
          throw new ForbiddenError();
        }

        const existing = await classSessions.findById(id);
        if (existing?.googleCalendarEventId) {
          await syncGoogleMeetBestEffort(
            googleMeet,
            () =>
              googleMeet!.deleteMeeting({
                eventId: existing.googleCalendarEventId!,
              }),
            { classSessionId: id, action: 'delete-soft' },
          );
        }
        if (existing?.zoomMeetingId) {
          await syncZoomMeetingBestEffort(
            zoomMeeting,
            () =>
              zoomMeeting!.deleteMeeting({
                meetingId: existing.zoomMeetingId!,
              }),
            { classSessionId: id, action: 'delete-soft' },
          );
        }

        let classSession = await deleteClassSession(
          classSessions,
          id,
          actor,
        );
        if (
          existing?.googleCalendarEventId ||
          existing?.zoomMeetingId ||
          existing?.meetingUrl
        ) {
          classSession = await updateClassSession(
            classSessions,
            id,
            {
              meetingUrl: null,
              googleCalendarEventId: null,
              zoomMeetingId: null,
            },
            actor,
          );
        }
        const body: ClassSessionResponse = { classSession };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof ClassSessionNotFoundError) {
          next(new NotFoundError(error.message));
          return;
        }
        if (error instanceof ClassSessionForbiddenError) {
          next(new ForbiddenError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.get(
    '/classes/:id/attendance',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Class session id is required.');

          const scope = await resolveClassSessionReadScope(
            permissionGrants,
            req.user!,
            teachers,
            students,
          );
          if (!scope) {
            throw new ForbiddenError();
          }

          // Enforce ClassSession ownership before listing attendance (IDOR).
          await getClassSession(classSessions, id, scope);

          const listFilter =
            scope.mode === 'student' ? { studentId: scope.studentId } : undefined;
          const body: AttendanceListResponse = {
            attendances: await listAttendanceForClassSession(
              attendances,
              id,
              listFilter,
            ),
          };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ClassSessionNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof ClassSessionForbiddenError) {
            next(new ForbiddenError(error.message));
            return;
          }
          if (error instanceof AttendanceNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.post(
    '/classes/:id/attendance',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Class session id is required.');

          const actor = await resolveClassSessionWriteActor(
            permissionGrants,
            req.user!,
            teachers,
          );
          if (!actor) {
            throw new ForbiddenError();
          }

          const parsed = createAttendanceRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid studentId and status (PRESENT|ABSENT) are required.',
            );
          }

          const attendance = await createAttendance(
            attendances,
            id,
            parsed.data,
            actor,
          );
          const body: AttendanceResponse = { attendance };
          res.status(201).json(body);
        } catch (error) {
          if (error instanceof AttendanceForbiddenError) {
            next(new ForbiddenError(error.message));
            return;
          }
          if (error instanceof AttendanceAlreadyExistsError) {
            next(new ConflictError(error.message));
            return;
          }
          if (error instanceof AttendanceNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof AttendanceValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.patch(
    '/classes/:id/attendance/:studentId',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          const studentId = pathId(req.params['studentId']);
          if (!id) throw new BadRequestError('Class session id is required.');
          if (!studentId) throw new BadRequestError('Student id is required.');

          const actor = await resolveClassSessionWriteActor(
            permissionGrants,
            req.user!,
            teachers,
          );
          if (!actor) {
            throw new ForbiddenError();
          }

          const parsed = updateAttendanceRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid status (PRESENT|ABSENT) is required.',
            );
          }

          const attendance = await updateAttendance(
            attendances,
            id,
            studentId,
            parsed.data,
            actor,
          );
          const body: AttendanceResponse = { attendance };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof AttendanceForbiddenError) {
            next(new ForbiddenError(error.message));
            return;
          }
          if (error instanceof AttendanceNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof AttendanceValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.get(
    '/classes/:id/notes',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Class session id is required.');

          const scope = await resolveClassSessionReadScope(
            permissionGrants,
            req.user!,
            teachers,
            students,
          );
          if (!scope) {
            throw new ForbiddenError();
          }

          await getClassSession(classSessions, id, scope);

          const body: ClassNoteListResponse = {
            notes: await listClassNotes(classNotes, id),
          };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ClassSessionNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof ClassSessionForbiddenError) {
            next(new ForbiddenError(error.message));
            return;
          }
          if (error instanceof ClassNoteNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.post(
    '/classes/:id/notes',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Class session id is required.');

          const actor = await resolveClassSessionWriteActor(
            permissionGrants,
            req.user!,
            teachers,
          );
          if (!actor) {
            throw new ForbiddenError();
          }

          const parsed = createClassNoteRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid non-empty content is required.',
            );
          }

          const note = await createClassNote(
            classNotes,
            id,
            parsed.data,
            actor,
          );
          const body: ClassNoteResponse = { note };
          res.status(201).json(body);
        } catch (error) {
          if (error instanceof ClassNoteForbiddenError) {
            next(new ForbiddenError(error.message));
            return;
          }
          if (error instanceof ClassNoteNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof ClassNoteValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.patch(
    '/classes/:id/notes/:noteId',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          const noteId = pathId(req.params['noteId']);
          if (!id) throw new BadRequestError('Class session id is required.');
          if (!noteId) throw new BadRequestError('Note id is required.');

          const actor = await resolveClassSessionWriteActor(
            permissionGrants,
            req.user!,
            teachers,
          );
          if (!actor) {
            throw new ForbiddenError();
          }

          const parsed = updateClassNoteRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid non-empty content is required.',
            );
          }

          const note = await updateClassNote(
            classNotes,
            id,
            noteId,
            parsed.data,
            actor,
          );
          const body: ClassNoteResponse = { note };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ClassNoteForbiddenError) {
            next(new ForbiddenError(error.message));
            return;
          }
          if (error instanceof ClassNoteNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof ClassNoteValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/classes/:id/notes/:noteId',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          const noteId = pathId(req.params['noteId']);
          if (!id) throw new BadRequestError('Class session id is required.');
          if (!noteId) throw new BadRequestError('Note id is required.');

          const actor = await resolveClassSessionWriteActor(
            permissionGrants,
            req.user!,
            teachers,
          );
          if (!actor) {
            throw new ForbiddenError();
          }

          await deleteClassNote(classNotes, id, noteId, actor);
          res.status(204).send();
        } catch (error) {
          if (error instanceof ClassNoteForbiddenError) {
            next(new ForbiddenError(error.message));
            return;
          }
          if (error instanceof ClassNoteNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof ClassNoteValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  return router;
}
