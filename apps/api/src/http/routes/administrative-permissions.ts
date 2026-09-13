import {
  managePermissionRequestSchema,
  PERMISSION_CATALOG,
  type PermissionListResponse,
  type PermissionMutationResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import {
  grantAdministrativePermission,
  listAdministrativePermissions,
  revokeAdministrativePermission,
  UnknownPermissionError,
  type AdministrativePermissionStore,
} from '../../domain/authorization/manage-administrative-permissions.js';
import {
  recordPermissionChange,
  type PermissionChangeAuditStore,
} from '../../domain/authorization/permission-change-audit.js';
import { BadRequestError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

const TARGET_ROLE = 'ADMINISTRATIVE' as const;

export interface AdministrativePermissionsDependencies {
  authenticate: AuthenticateOptions;
  administrativePermissions: AdministrativePermissionStore;
  /** Used by requirePermission; never trust client-supplied grants. */
  permissionGrants: PermissionGrantStore;
  permissionChangeAudits: PermissionChangeAuditStore;
}

/**
 * Management of ADMINISTRATIVE RolePermission grants.
 *
 * Authorization: authenticate + requirePermission.
 * - GET catalog / list → permissions.read
 * - POST grant / DELETE revoke → permissions.update
 *
 * Successful mutations append a PermissionChangeAudit row (actor from session).
 */
export function createAdministrativePermissionsRouter({
  authenticate: authOptions,
  administrativePermissions,
  permissionGrants,
  permissionChangeAudits,
}: AdministrativePermissionsDependencies): Router {
  const router = Router();
  const readGuard = [
    authenticate(authOptions),
    requirePermission(permissionGrants, 'permissions', 'read'),
  ] as const;
  const updateGuard = [
    authenticate(authOptions),
    requirePermission(permissionGrants, 'permissions', 'update'),
  ] as const;

  router.get('/permissions/catalog', ...readGuard, (_req, res) => {
    const body: PermissionListResponse = {
      permissions: [...PERMISSION_CATALOG],
    };
    res.status(200).json(body);
  });

  router.get(
    '/roles/administrative/permissions',
    ...readGuard,
    (_req, res, next) => {
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
    },
  );

  router.post(
    '/roles/administrative/permissions',
    ...updateGuard,
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = managePermissionRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A catalog permission with module and action is required.',
            );
          }

          const actor = req.user!;
          const { outcome, permission } = await grantAdministrativePermission(
            administrativePermissions,
            parsed.data.module,
            parsed.data.action,
          );

          await recordPermissionChange(permissionChangeAudits, {
            actorUserId: actor.id,
            targetRole: TARGET_ROLE,
            changeType: 'GRANT',
            module: permission.module,
            action: permission.action,
            outcome,
          });

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
    },
  );

  router.delete(
    '/roles/administrative/permissions',
    ...updateGuard,
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = managePermissionRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A catalog permission with module and action is required.',
            );
          }

          const actor = req.user!;
          const { outcome, permission } = await revokeAdministrativePermission(
            administrativePermissions,
            parsed.data.module,
            parsed.data.action,
          );

          await recordPermissionChange(permissionChangeAudits, {
            actorUserId: actor.id,
            targetRole: TARGET_ROLE,
            changeType: 'REVOKE',
            module: permission.module,
            action: permission.action,
            outcome,
          });

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
