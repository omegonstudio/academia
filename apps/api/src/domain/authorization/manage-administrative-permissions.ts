import type {
  PermissionAction,
  PermissionModule,
  PermissionRef,
} from '@academia/shared';
import { isCatalogPermission } from '@academia/shared';

export type GrantOutcome = 'created' | 'exists';
export type RevokeOutcome = 'removed' | 'missing';

/**
 * Persistence for ADMINISTRATIVE RolePermission rows.
 * Role is fixed by the domain; callers never choose another target role.
 */
export interface AdministrativePermissionStore {
  listGranted(): Promise<PermissionRef[]>;
  grant(
    module: PermissionModule,
    action: PermissionAction,
  ): Promise<GrantOutcome>;
  revoke(
    module: PermissionModule,
    action: PermissionAction,
  ): Promise<RevokeOutcome>;
}

export class UnknownPermissionError extends Error {
  constructor(module: string, action: string) {
    super(`Permission ${module}.${action} is not in the catalog.`);
    this.name = 'UnknownPermissionError';
  }
}

function resolveCatalogPermission(
  module: string,
  action: string,
): PermissionRef {
  if (!isCatalogPermission(module, action)) {
    throw new UnknownPermissionError(module, action);
  }
  return {
    module: module as PermissionModule,
    action: action as PermissionAction,
  };
}

/** Lists RolePermission grants currently held by ADMINISTRATIVE. */
export async function listAdministrativePermissions(
  store: AdministrativePermissionStore,
): Promise<PermissionRef[]> {
  return store.listGranted();
}

/**
 * Grants a catalog permission to the ADMINISTRATIVE role.
 * Idempotent: repeating an existing grant returns `exists`.
 */
export async function grantAdministrativePermission(
  store: AdministrativePermissionStore,
  module: string,
  action: string,
): Promise<{ outcome: GrantOutcome; permission: PermissionRef }> {
  const permission = resolveCatalogPermission(module, action);
  const outcome = await store.grant(permission.module, permission.action);
  return { outcome, permission };
}

/**
 * Removes a catalog permission from the ADMINISTRATIVE role.
 * Idempotent: revoking a missing grant returns `missing`.
 */
export async function revokeAdministrativePermission(
  store: AdministrativePermissionStore,
  module: string,
  action: string,
): Promise<{ outcome: RevokeOutcome; permission: PermissionRef }> {
  const permission = resolveCatalogPermission(module, action);
  const outcome = await store.revoke(permission.module, permission.action);
  return { outcome, permission };
}
