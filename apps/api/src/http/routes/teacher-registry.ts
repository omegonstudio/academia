import {
  createTeacherRequestSchema,
  updateTeacherRequestSchema,
  type SessionUser,
  type TeacherListResponse,
  type TeacherResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import { hasPermission } from '../../domain/authorization/has-permission.js';
import {
  createTeacher,
  deleteTeacher,
  getTeacher,
  listTeachers,
  TeacherConflictError,
  TeacherNotFoundError,
  TeacherValidationError,
  updateTeacher,
  type TeacherStore,
} from '../../domain/teachers/teacher-service.js';
import { hashPassword } from '../../lib/password.js';
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

export interface TeacherRegistryDependencies {
  authenticate: AuthenticateOptions;
  teachers: TeacherStore;
  permissionGrants: PermissionGrantStore;
}

async function mayReadTeacher(
  grants: PermissionGrantStore,
  user: SessionUser,
  teacherUserId: string,
): Promise<boolean> {
  if (await hasPermission(grants, user.role, 'teachers', 'read')) {
    return true;
  }
  return user.role === 'TEACHER' && user.id === teacherUserId;
}

/**
 * Academic teacher registry (`/teachers`).
 * Identity provisioning remains at `POST /users/teachers`.
 */
export function createTeacherRegistryRouter({
  authenticate: authOptions,
  teachers,
  permissionGrants,
}: TeacherRegistryDependencies): Router {
  const router = Router();

  router.get(
    '/teachers',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'teachers', 'read'),
    (_req, res, next) => {
      void (async () => {
        try {
          const body: TeacherListResponse = {
            teachers: await listTeachers(teachers),
          };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/teachers',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'teachers', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createTeacherRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid email, firstName, lastName, level and password (when creating a new account) are required.',
            );
          }

          const teacher = await createTeacher(
            teachers,
            parsed.data,
            hashPassword,
          );
          const body: TeacherResponse = { teacher };
          res.status(201).json(body);
        } catch (error) {
          if (error instanceof TeacherConflictError) {
            next(new ConflictError(error.message));
            return;
          }
          if (error instanceof TeacherValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.get('/teachers/:id', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const rawId = req.params['id'];
        const id = typeof rawId === 'string' ? rawId : rawId?.[0];
        if (!id) throw new BadRequestError('Teacher id is required.');

        const teacher = await getTeacher(teachers, id);
        const allowed = await mayReadTeacher(
          permissionGrants,
          req.user!,
          teacher.userId,
        );
        if (!allowed) {
          throw new ForbiddenError();
        }

        const body: TeacherResponse = { teacher };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof TeacherNotFoundError) {
          next(new NotFoundError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.patch(
    '/teachers/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'teachers', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const rawId = req.params['id'];
          const id = typeof rawId === 'string' ? rawId : rawId?.[0];
          if (!id) throw new BadRequestError('Teacher id is required.');

          const parsed = updateTeacherRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Provide at least one of firstName, lastName, level, availability or isActive.',
            );
          }

          const teacher = await updateTeacher(teachers, id, parsed.data);
          const body: TeacherResponse = { teacher };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof TeacherNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/teachers/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'teachers', 'delete'),
    (req, res, next) => {
      void (async () => {
        try {
          const rawId = req.params['id'];
          const id = typeof rawId === 'string' ? rawId : rawId?.[0];
          if (!id) throw new BadRequestError('Teacher id is required.');

          const teacher = await deleteTeacher(teachers, id);
          const body: TeacherResponse = { teacher };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof TeacherNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  return router;
}
