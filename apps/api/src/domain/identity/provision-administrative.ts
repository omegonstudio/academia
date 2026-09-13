import type { Database } from '../../lib/prisma.js';
import type { ProvisionRoleInput, RoleProvisionStore } from './provision-role.js';
import { provisionRole } from './provision-role.js';
import { createRoleProvisionStore } from './role-provision-store.js';

export {
  RoleConflictError,
  type ProvisionIdentityRecord as AdministrativeIdentityRecord,
  type ProvisionRoleInput as ProvisionAdministrativeInput,
  type ProvisionRoleOutcome as ProvisionAdministrativeOutcome,
  type RoleProvisionStore as AdministrativeProvisionStore,
} from './provision-role.js';

/** Provisions an ADMINISTRATIVE via the shared role-provisioning domain. */
export function provisionAdministrative(
  store: RoleProvisionStore,
  input: ProvisionRoleInput,
) {
  return provisionRole(store, 'ADMINISTRATIVE', input);
}

/** Prisma store bound to ADMINISTRATIVE. */
export function createAdministrativeProvisionStore(database: Database) {
  return createRoleProvisionStore(database, 'ADMINISTRATIVE');
}
