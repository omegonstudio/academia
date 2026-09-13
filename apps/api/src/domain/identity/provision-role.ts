import type { Role, SessionUser } from '@academia/shared';
import { hashPassword } from '../../lib/password.js';
import { normalizeEmail } from './user-repository.js';

export type ProvisionRoleOutcome = 'created' | 'reasserted';

export class RoleConflictError extends Error {
  constructor(message = 'That email is already registered with a different role.') {
    super(message);
    this.name = 'RoleConflictError';
  }
}

export interface ProvisionRoleInput {
  email: string;
  password: string;
  name?: string | undefined;
}

export interface ProvisionIdentityRecord {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
}

/**
 * Persistence port for role provisioning.
 *
 * The store is bound to one target role at construction (see
 * `createRoleProvisionStore`). Domain logic still receives `targetRole` so the
 * conflict check cannot drift from what `create` writes.
 */
export interface RoleProvisionStore {
  findByEmail(email: string): Promise<ProvisionIdentityRecord | null>;
  create(input: {
    email: string;
    name: string | null;
    passwordHash: string;
  }): Promise<ProvisionIdentityRecord>;
  reassertActive(id: string): Promise<ProvisionIdentityRecord>;
}

function toSessionUser(record: ProvisionIdentityRecord): SessionUser {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
  };
}

/**
 * Creates or reasserts an account for a fixed role.
 *
 * - Missing email → create with `targetRole` (never taken from the caller).
 * - Existing same role → reassert active; password is never overwritten.
 * - Existing other role → conflict (prevents silent role hijacking).
 */
export async function provisionRole(
  store: RoleProvisionStore,
  targetRole: Role,
  input: ProvisionRoleInput,
): Promise<{ outcome: ProvisionRoleOutcome; user: SessionUser }> {
  const email = normalizeEmail(input.email);
  const name = input.name?.trim() ? input.name.trim() : null;

  const existing = await store.findByEmail(email);

  if (existing) {
    if (existing.role !== targetRole) {
      throw new RoleConflictError();
    }

    const user = existing.isActive
      ? toSessionUser(existing)
      : toSessionUser(await store.reassertActive(existing.id));

    return { outcome: 'reasserted', user };
  }

  const created = await store.create({
    email,
    name,
    passwordHash: await hashPassword(input.password),
  });

  return { outcome: 'created', user: toSessionUser(created) };
}
