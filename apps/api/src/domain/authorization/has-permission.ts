import type {
  PermissionAction,
  PermissionModule,
  Role,
} from '@academia/shared';
import { isCatalogPermission } from '@academia/shared';

export interface PermissionGrantStore {
  /**
   * True when `role` has an explicit RolePermission row for (module, action).
   */
  roleOwns(
    role: Role,
    module: PermissionModule,
    action: PermissionAction,
  ): Promise<boolean>;
}

/**
 * Resolves whether a role may perform `action` on `module`.
 *
 * - SUPER_ADMIN / DIRECTOR: always allowed for catalog permissions (product
 *   rule: technical total / operational total). Grant rows are not consulted.
 * - Other roles: require an explicit RolePermission row.
 * - Unknown (module, action) pairs outside the catalog are never allowed.
 *
 * Ready for route mounting via `requirePermission`; academy feature routes are
 * not wired yet — that is a later Stage 1 task.
 */
export async function hasPermission(
  store: PermissionGrantStore,
  role: Role,
  module: string,
  action: string,
): Promise<boolean> {
  if (!isCatalogPermission(module, action)) {
    return false;
  }

  if (role === 'SUPER_ADMIN' || role === 'DIRECTOR') {
    return true;
  }

  return store.roleOwns(
    role,
    module as PermissionModule,
    action as PermissionAction,
  );
}
