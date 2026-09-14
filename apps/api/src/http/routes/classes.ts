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
} from '../../domain/classes/class-session-service.js';
import type { StudentStore } from '../../domain/students/student-service.js';
import type { TeacherStore } from '../../domain/teachers/teacher-service.js';
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
import { requirePermission } from '../middleware/require-permission.js';

export interface ClassSessionsDependencies {
  authenticate: AuthenticateOptions;
  classSessions: ClassSessionStore;
  attendances: AttendanceStore;
  classNotes: ClassNoteStore;
  teachers: TeacherStore;
  students: StudentStore;
  academy: AcademyBusinessConfig;
  permissionGrants: PermissionGrantStore;
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
 * Nested write ownership for Attendance / ClassNotes:
 * classes.update → admin; TEACHER of the Group → teacher actor.
 * Students never write. Session identity only.
 */
async function resolveClassSessionWriteActor(
  grants: PermissionGrantStore,
  user: SessionUser,
  teachers: TeacherStore,
): Promise<AttendanceWriteActor | null> {
  if (await hasPermission(grants, user.role, 'classes', 'update')) {
    return { mode: 'admin' };
  }
  if (user.role === 'TEACHER') {
    const teacher = await teachers.findByUserId(user.id);
    if (!teacher) return null;
    return { mode: 'teacher', teacherId: teacher.id };
  }
  return null;
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

  router.post(
    '/classes',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'classes', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createClassSessionRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid groupId and startAt (ISO datetime) are required.',
            );
          }
          const classSession = await createClassSession(
            classSessions,
            parsed.data,
          );
          const body: ClassSessionResponse = { classSession };
          res.status(201).json(body);
        } catch (error) {
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
    },
  );

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

  router.patch(
    '/classes/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'classes', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Class session id is required.');
          const parsed = updateClassSessionRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Provide at least one of startAt, isActive, or meetingUrl.',
            );
          }
          const classSession = await updateClassSession(
            classSessions,
            id,
            parsed.data,
          );
          const body: ClassSessionResponse = { classSession };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ClassSessionNotFoundError) {
            next(new NotFoundError(error.message));
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
    },
  );

  router.delete(
    '/classes/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'classes', 'delete'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Class session id is required.');
          const classSession = await deleteClassSession(classSessions, id);
          const body: ClassSessionResponse = { classSession };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof ClassSessionNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

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
