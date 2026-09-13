import {
  createStudentRequestSchema,
  updateStudentRequestSchema,
  type SessionUser,
  type StudentListResponse,
  type StudentResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import { hasPermission } from '../../domain/authorization/has-permission.js';
import {
  createStudent,
  deleteStudent,
  getStudent,
  listStudents,
  StudentConflictError,
  StudentNotFoundError,
  StudentValidationError,
  updateStudent,
  type StudentStore,
} from '../../domain/students/student-service.js';
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

export interface StudentRegistryDependencies {
  authenticate: AuthenticateOptions;
  students: StudentStore;
  permissionGrants: PermissionGrantStore;
}

async function mayReadStudent(
  grants: PermissionGrantStore,
  user: SessionUser,
  studentUserId: string,
): Promise<boolean> {
  if (await hasPermission(grants, user.role, 'students', 'read')) {
    return true;
  }
  return user.role === 'STUDENT' && user.id === studentUserId;
}

/**
 * Academic student registry (`/students`).
 * Identity provisioning remains at `POST /users/students`.
 */
export function createStudentRegistryRouter({
  authenticate: authOptions,
  students,
  permissionGrants,
}: StudentRegistryDependencies): Router {
  const router = Router();

  router.get(
    '/students',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'students', 'read'),
    (_req, res, next) => {
      void (async () => {
        try {
          const body: StudentListResponse = {
            students: await listStudents(students),
          };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/students',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'students', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createStudentRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid email, firstName, lastName, level and password (when creating a new account) are required.',
            );
          }

          const student = await createStudent(
            students,
            parsed.data,
            hashPassword,
          );
          const body: StudentResponse = { student };
          res.status(201).json(body);
        } catch (error) {
          if (error instanceof StudentConflictError) {
            next(new ConflictError(error.message));
            return;
          }
          if (error instanceof StudentValidationError) {
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.get('/students/:id', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const rawId = req.params['id'];
        const id = typeof rawId === 'string' ? rawId : rawId?.[0];
        if (!id) throw new BadRequestError('Student id is required.');

        const student = await getStudent(students, id);
        const allowed = await mayReadStudent(
          permissionGrants,
          req.user!,
          student.userId,
        );
        if (!allowed) {
          throw new ForbiddenError();
        }

        const body: StudentResponse = { student };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof StudentNotFoundError) {
          next(new NotFoundError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.patch(
    '/students/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'students', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const rawId = req.params['id'];
          const id = typeof rawId === 'string' ? rawId : rawId?.[0];
          if (!id) throw new BadRequestError('Student id is required.');

          const parsed = updateStudentRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Provide at least one of firstName, lastName, level or isActive.',
            );
          }

          const student = await updateStudent(students, id, parsed.data);
          const body: StudentResponse = { student };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof StudentNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/students/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'students', 'delete'),
    (req, res, next) => {
      void (async () => {
        try {
          const rawId = req.params['id'];
          const id = typeof rawId === 'string' ? rawId : rawId?.[0];
          if (!id) throw new BadRequestError('Student id is required.');

          const student = await deleteStudent(students, id);
          const body: StudentResponse = { student };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof StudentNotFoundError) {
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
