import type { Database } from '../../lib/prisma.js';
import type { ProvisionRoleInput, RoleProvisionStore } from './provision-role.js';
import { provisionRole } from './provision-role.js';
import { createRoleProvisionStore } from './role-provision-store.js';

export {
  RoleConflictError,
  type ProvisionIdentityRecord as DirectorIdentityRecord,
  type ProvisionRoleInput as ProvisionDirectorInput,
  type ProvisionRoleOutcome as ProvisionDirectorOutcome,
  type RoleProvisionStore as DirectorProvisionStore,
} from './provision-role.js';

/** Provisions a DIRECTOR via the shared role-provisioning domain. */
export function provisionDirector(
  store: RoleProvisionStore,
  input: ProvisionRoleInput,
) {
  return provisionRole(store, 'DIRECTOR', input);
}

/** Prisma store bound to DIRECTOR. */
export function createDirectorProvisionStore(database: Database) {
  return createRoleProvisionStore(database, 'DIRECTOR');
}
