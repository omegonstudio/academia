import {
  provisionAdministrativeRequestSchema,
  type SessionResponse,
} from '@academia/shared';
import { Router } from 'express';
import {
  provisionAdministrative,
  RoleConflictError,
  type AdministrativeProvisionStore,
} from '../../domain/identity/provision-administrative.js';
import { BadRequestError, ConflictError } from '../errors.js';
import {
  authenticate,
  requireRole,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface AdministrativesDependencies {
  authenticate: AuthenticateOptions;
  administratives: AdministrativeProvisionStore;
}

/**
 * Administrative provisioning.
 *
 * DIRECTOR operates the academy and may create ADMINISTRATIVE staff.
 * SUPER_ADMIN retains technical access. The role is assigned server-side.
 */
export function createAdministrativesRouter({
  authenticate: authOptions,
  administratives,
}: AdministrativesDependencies): Router {
  const router = Router();

  router.post(
    '/users/administratives',
    authenticate(authOptions),
    requireRole('SUPER_ADMIN', 'DIRECTOR'),
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
