import {
  provisionTeacherRequestSchema,
  type SessionResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import {
  provisionTeacher,
  RoleConflictError,
  type TeacherProvisionStore,
} from '../../domain/identity/provision-teacher.js';
import { BadRequestError, ConflictError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface TeachersDependencies {
  authenticate: AuthenticateOptions;
  teachers: TeacherProvisionStore;
  permissionGrants: PermissionGrantStore;
}

/**
 * Teacher provisioning.
 *
 * Requires `users.create`. SUPER_ADMIN/DIRECTOR pass via hasPermission bypass;
 * other roles need an explicit grant. Role is assigned server-side.
 */
export function createTeachersRouter({
  authenticate: authOptions,
  teachers,
  permissionGrants,
}: TeachersDependencies): Router {
  const router = Router();

  router.post(
    '/users/teachers',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'users', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = provisionTeacherRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A valid email, password (min. 12 characters) and optional name are required.',
            );
          }

          const { outcome, user } = await provisionTeacher(teachers, parsed.data);
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
