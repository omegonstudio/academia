import {
  provisionAdministrativeRequestSchema,
  type SessionResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import {
  provisionAdministrative,
  RoleConflictError,
  type AdministrativeProvisionStore,
} from '../../domain/identity/provision-administrative.js';
import { BadRequestError, ConflictError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface AdministrativesDependencies {
  authenticate: AuthenticateOptions;
  administratives: AdministrativeProvisionStore;
  permissionGrants: PermissionGrantStore;
}

/**
 * Administrative provisioning.
 *
 * Requires `users.create`. SUPER_ADMIN/DIRECTOR pass via hasPermission bypass;
 * other roles need an explicit grant. Role is assigned server-side.
 */
export function createAdministrativesRouter({
  authenticate: authOptions,
  administratives,
  permissionGrants,
}: AdministrativesDependencies): Router {
  const router = Router();

  router.post(
    '/users/administratives',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'users', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = provisionAdministrativeRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A valid email, password (min. 12 characters) and optional name are required.',
            );
          }

          const { outcome, user } = await provisionAdministrative(
            administratives,
            parsed.data,
          );
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
