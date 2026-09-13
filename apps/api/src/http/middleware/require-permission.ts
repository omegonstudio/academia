import type { PermissionAction, PermissionModule } from '@academia/shared';
import type { RequestHandler } from 'express';
import {
  hasPermission,
  type PermissionGrantStore,
} from '../../domain/authorization/has-permission.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';

/**
 * Restricts a route to callers whose role may perform `action` on `module`.
 *
 * Must always be mounted after `authenticate`. Resolves authorization from
 * `req.user.role` via `hasPermission` (SUPER_ADMIN/DIRECTOR bypass; others need
 * RolePermission grants). Never reads permissions from the request body or
 * query string.
 *
 * Ready for route mounting; academy feature routes are not wired yet.
 */
export function requirePermission(
  store: PermissionGrantStore,
  module: PermissionModule,
  action: PermissionAction,
): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      try {
        if (!req.user) {
          next(new UnauthorizedError());
          return;
        }

        const allowed = await hasPermission(
          store,
          req.user.role,
          module,
          action,
        );
        if (!allowed) {
          next(new ForbiddenError());
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    })();
  };
}
