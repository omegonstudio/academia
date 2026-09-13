import {
  managePermissionRequestSchema,
  PERMISSION_CATALOG,
  type PermissionListResponse,
  type PermissionMutationResponse,
} from '@academia/shared';
import { Router } from 'express';
import {
  grantAdministrativePermission,
  listAdministrativePermissions,
  revokeAdministrativePermission,
  UnknownPermissionError,
  type AdministrativePermissionStore,
} from '../../domain/authorization/manage-administrative-permissions.js';
import { BadRequestError } from '../errors.js';
import {
  authenticate,
  requireRole,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface AdministrativePermissionsDependencies {
  authenticate: AuthenticateOptions;
  administrativePermissions: AdministrativePermissionStore;
}

/**
 * Director/SuperAdmin management of ADMINISTRATIVE RolePermission grants.
 *
 * Does not mount requirePermission on other academy routes; only gatekeeps
 * this configuration surface with requireRole.
 */
export function createAdministrativePermissionsRouter({
  authenticate: authOptions,
  administrativePermissions,
}: AdministrativePermissionsDependencies): Router {
  const router = Router();
  const guard = [
    authenticate(authOptions),
    requireRole('SUPER_ADMIN', 'DIRECTOR'),
  ] as const;

  router.get('/permissions/catalog', ...guard, (_req, res) => {
    const body: PermissionListResponse = {
      permissions: [...PERMISSION_CATALOG],
    };
    res.status(200).json(body);
  });

  router.get('/roles/administrative/permissions', ...guard, (_req, res, next) => {
    void (async () => {
      try {
        const permissions = await listAdministrativePermissions(
          administrativePermissions,
        );
        const body: PermissionListResponse = { permissions };
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    })();
  });

  router.post('/roles/administrative/permissions', ...guard, (req, res, next) => {
    void (async () => {
      try {
        const parsed = managePermissionRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError(
            'A catalog permission with module and action is required.',
          );
        }

        const { outcome, permission } = await grantAdministrativePermission(
          administrativePermissions,
          parsed.data.module,
          parsed.data.action,
        );
        const body: PermissionMutationResponse = { permission };
        res.status(outcome === 'created' ? 201 : 200).json(body);
      } catch (error) {
        if (error instanceof UnknownPermissionError) {
          next(new BadRequestError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.delete(
    '/roles/administrative/permissions',
    ...guard,
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = managePermissionRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A catalog permission with module and action is required.',
            );
          }

          await revokeAdministrativePermission(
            administrativePermissions,
            parsed.data.module,
            parsed.data.action,
          );
          res.status(204).send();
        } catch (error) {
          if (error instanceof UnknownPermissionError) {
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
