import type { Database } from '../../lib/prisma.js';
import type { ProvisionRoleInput, RoleProvisionStore } from './provision-role.js';
import { provisionRole } from './provision-role.js';
import { createRoleProvisionStore } from './role-provision-store.js';

export {
  RoleConflictError,
  type ProvisionIdentityRecord as TeacherIdentityRecord,
  type ProvisionRoleInput as ProvisionTeacherInput,
  type ProvisionRoleOutcome as ProvisionTeacherOutcome,
  type RoleProvisionStore as TeacherProvisionStore,
} from './provision-role.js';

/** Provisions a TEACHER via the shared role-provisioning domain. */
export function provisionTeacher(
  store: RoleProvisionStore,
  input: ProvisionRoleInput,
) {
  return provisionRole(store, 'TEACHER', input);
}

/** Prisma store bound to TEACHER. */
export function createTeacherProvisionStore(database: Database) {
  return createRoleProvisionStore(database, 'TEACHER');
}
