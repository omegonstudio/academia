import type { Database } from '../../lib/prisma.js';
import type { ProvisionRoleInput, RoleProvisionStore } from './provision-role.js';
import { provisionRole } from './provision-role.js';
import { createRoleProvisionStore } from './role-provision-store.js';

export {
  RoleConflictError,
  type ProvisionIdentityRecord as StudentIdentityRecord,
  type ProvisionRoleInput as ProvisionStudentInput,
  type ProvisionRoleOutcome as ProvisionStudentOutcome,
  type RoleProvisionStore as StudentProvisionStore,
} from './provision-role.js';

/** Provisions a STUDENT via the shared role-provisioning domain. */
export function provisionStudent(
  store: RoleProvisionStore,
  input: ProvisionRoleInput,
) {
  return provisionRole(store, 'STUDENT', input);
}

/** Prisma store bound to STUDENT. */
export function createStudentProvisionStore(database: Database) {
  return createRoleProvisionStore(database, 'STUDENT');
}
