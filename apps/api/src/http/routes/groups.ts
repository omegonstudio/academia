import {
  createGroupRequestSchema,
  updateGroupRequestSchema,
  assignGroupTeacherRequestSchema,
  enrollStudentRequestSchema,
  generateClassSessionsRequestSchema,
  type GroupListResponse,
  type GroupResponse,
  type GroupTeacherResponse,
  type EnrollmentListResponse,
  type EnrollmentResponse,
  type GenerateClassSessionsResponse,
  type SessionUser,
} from '@academia/shared';
import { Router } from 'express';
import type { AcademyBusinessConfig } from '../../domain/academy/academy-config.js';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import { hasPermission } from '../../domain/authorization/has-permission.js';
import {
  ClassSessionValidationError,
  generateClassSessionsForGroup,
  type ClassSessionStore,
} from '../../domain/classes/class-session-service.js';
import {
  assignGroupTeacher,
  createGroup,
  deleteGroup,
  getGroup,
  getGroupTeacher,
  GroupNotFoundError,
  GroupValidationError,
  listGroups,
  unassignGroupTeacher,
  updateGroup,
  type GroupStore,
} from '../../domain/groups/group-service.js';
import {
  enrollStudentInGroup,
  EnrollmentNotFoundError,
  EnrollmentValidationError,
  listGroupEnrollments,
  unenrollStudentFromGroup,
  type EnrollmentStore,
} from '../../domain/enrollments/enrollment-service.js';
import {
  runAutoChargeForClassSessions,
  runAutoChargeForEnrollmentMonth,
} from '../../domain/finance/auto-charge-runner.js';
import type { FinanceStore } from '../../domain/finance/finance-store.js';
import type { TeacherStore } from '../../domain/teachers/teacher-service.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface GroupsDependencies {
  authenticate: AuthenticateOptions;
  groups: GroupStore;
  enrollments: EnrollmentStore;
  classSessions: ClassSessionStore;
  academy: AcademyBusinessConfig;
  permissionGrants: PermissionGrantStore;
  /** Optional: enables Teacher Hub ownership on group read / roster. */
  teachers?: TeacherStore;
  /** Optional: auto-charge after enroll / generate (GROUP / ONE_TO_ONE). */
  finance?: FinanceStore;
}

/**
 * Admin `groups.read`, or TEACHER who owns the group (Group.teacherId).
 * Non-teachers without the grant get 403 without probing existence.
 * Session identity only.
 */
async function assertCanReadGroup(
  grants: PermissionGrantStore,
  teachers: TeacherStore | undefined,
  groups: GroupStore,
  user: SessionUser,
  groupId: string,
): Promise<void> {
  if (await hasPermission(grants, user.role, 'groups', 'read')) {
    return;
  }
  if (user.role === 'TEACHER' && teachers) {
    const group = await getGroup(groups, groupId);
    const teacher = await teachers.findByUserId(user.id);
    if (teacher && group.teacherId === teacher.id) {
      return;
    }
    throw new ForbiddenError(
      'You do not have permission to perform this action.',
    );
  }
  throw new ForbiddenError(
    'You do not have permission to perform this action.',
  );
}

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

export function createGroupsRouter({
  authenticate: authOptions,
  groups,
  enrollments,
  classSessions,
  academy,
  permissionGrants,
  teachers,
  finance,
}: GroupsDependencies): Router {
  const router = Router();

  router.get(
    '/groups',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'read'),
    (_req, res, next) => {
      void (async () => {
        try {
          const body: GroupListResponse = { groups: await listGroups(groups) };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/groups',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createGroupRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Valid courseId and name are required.');
          }
          const group = await createGroup(groups, parsed.data);
          const body: GroupResponse = { group };
          res.status(201).json(body);
        } catch (error) {
          if (error instanceof GroupValidationError) {
            if (error.message === 'Course not found.') {
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

  router.get(
    '/groups/:id',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          await assertCanReadGroup(
            permissionGrants,
            teachers,
            groups,
            req.user!,
            id,
          );
          const group = await getGroup(groups, id);
          const body: GroupResponse = { group };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof GroupNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.patch(
    '/groups/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          const parsed = updateGroupRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Provide at least one of name, isActive or scheduleOptionId.',
            );
          }
          const group = await updateGroup(groups, id, parsed.data);
          const body: GroupResponse = { group };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof GroupNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof GroupValidationError) {
            if (error.message === 'Schedule option not found.') {
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

  router.delete(
    '/groups/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'delete'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          const group = await deleteGroup(groups, id);
          const body: GroupResponse = { group };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof GroupNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.get(
    '/groups/:id/teacher',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          const link = await getGroupTeacher(groups, id);
          const body: GroupTeacherResponse = link;
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof GroupNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.post(
    '/groups/:id/teacher',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          const parsed = assignGroupTeacherRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('A valid teacherId is required.');
          }
          const link = await assignGroupTeacher(groups, id, parsed.data);
          const body: GroupTeacherResponse = link;
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof GroupNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof GroupValidationError) {
            if (error.message === 'Teacher not found.') {
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

  router.delete(
    '/groups/:id/teacher',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          await unassignGroupTeacher(groups, id);
          res.status(204).send();
        } catch (error) {
          if (error instanceof GroupNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.get(
    '/groups/:id/students',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          await assertCanReadGroup(
            permissionGrants,
            teachers,
            groups,
            req.user!,
            id,
          );
          const body: EnrollmentListResponse = {
            enrollments: await listGroupEnrollments(enrollments, id),
          };
          res.status(200).json(body);
        } catch (error) {
          if (
            error instanceof EnrollmentNotFoundError ||
            error instanceof GroupNotFoundError
          ) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.post(
    '/groups/:id/students',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          const parsed = enrollStudentRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('A valid studentId is required.');
          }
          const enrollment = await enrollStudentInGroup(
            enrollments,
            id,
            parsed.data,
          );
          if (finance) {
            await runAutoChargeForEnrollmentMonth(finance, {
              enrollmentId: enrollment.id,
              createdByUserId: req.user!.id,
              businessTimezone: academy.businessTimezone,
            });
          }
          const body: EnrollmentResponse = { enrollment };
          res.status(201).json(body);
        } catch (error) {
          if (error instanceof EnrollmentNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof EnrollmentValidationError) {
            if (error.message === 'Student not found.') {
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

  router.delete(
    '/groups/:id/students/:studentId',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'groups', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          const studentId = pathId(req.params['studentId']);
          if (!id) throw new BadRequestError('Group id is required.');
          if (!studentId) throw new BadRequestError('Student id is required.');
          await unenrollStudentFromGroup(enrollments, id, studentId);
          res.status(204).send();
        } catch (error) {
          if (error instanceof EnrollmentNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.post(
    '/groups/:id/classes/generate',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'classes', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Group id is required.');
          const parsed = generateClassSessionsRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid body.');
          }
          const body: GenerateClassSessionsResponse =
            await generateClassSessionsForGroup(
              classSessions,
              id,
              parsed.data,
              academy,
            );
          if (finance && body.classSessions.length > 0) {
            await runAutoChargeForClassSessions(finance, {
              classSessionIds: body.classSessions.map((s) => s.id),
              createdByUserId: req.user!.id,
            });
          }
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
    },
  );

  return router;
}
