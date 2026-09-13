import {
  provisionDirectorRequestSchema,
  type SessionResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import {
  provisionDirector,
  RoleConflictError,
  type DirectorProvisionStore,
} from '../../domain/identity/provision-director.js';
import { BadRequestError, ConflictError } from '../errors.js';
import {
  authenticate,
  requireRole,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface DirectorsDependencies {
  authenticate: AuthenticateOptions;
  directors: DirectorProvisionStore;
  permissionGrants: PermissionGrantStore;
}

/**
 * Director provisioning.
 *
 * SUPER_ADMIN only (role gate). Also requires `users.create` via
 * requirePermission; SUPER_ADMIN passes the permission policy by bypass.
 */
export function createDirectorsRouter({
  authenticate: authOptions,
  directors,
  permissionGrants,
}: DirectorsDependencies): Router {
  const router = Router();

  router.post(
    '/users/directors',
    authenticate(authOptions),
    requireRole('SUPER_ADMIN'),
    requirePermission(permissionGrants, 'users', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = provisionDirectorRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A valid email, password (min. 12 characters) and optional name are required.',
            );
          }

          const { outcome, user } = await provisionDirector(directors, parsed.data);
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
