import {
  provisionStudentRequestSchema,
  type SessionResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import {
  provisionStudent,
  RoleConflictError,
  type StudentProvisionStore,
} from '../../domain/identity/provision-student.js';
import { BadRequestError, ConflictError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface StudentsDependencies {
  authenticate: AuthenticateOptions;
  students: StudentProvisionStore;
  permissionGrants: PermissionGrantStore;
}

/**
 * Student provisioning.
 *
 * Requires `users.create`. SUPER_ADMIN/DIRECTOR pass via hasPermission bypass;
 * TEACHER/STUDENT/ADMINISTRATIVE without a grant are denied (teachers cannot
 * self-assign students). Role is assigned server-side.
 */
export function createStudentsRouter({
  authenticate: authOptions,
  students,
  permissionGrants,
}: StudentsDependencies): Router {
  const router = Router();

  router.post(
    '/users/students',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'users', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = provisionStudentRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A valid email, password (min. 12 characters) and optional name are required.',
            );
          }

          const { outcome, user } = await provisionStudent(students, parsed.data);
          const body: SessionResponse = { user };
          res.status(outcome === 'created' ? 201 : 200).json(body);
        } catch (error) {
          if (error instanceof RoleConflictError) {
            next(new ConflictError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  return router;
}
