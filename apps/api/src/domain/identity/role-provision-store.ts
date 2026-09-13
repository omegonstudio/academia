import type { Role } from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import type {
  ProvisionIdentityRecord,
  RoleProvisionStore,
} from './provision-role.js';
import { normalizeEmail } from './user-repository.js';

const SELECTION = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
} as const;

function asRecord(row: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
}): ProvisionIdentityRecord {
  return { ...row, role: row.role as Role };
}

/** Prisma-backed store bound to one provisionable role. */
export function createRoleProvisionStore(
  database: Database,
  role: Role,
): RoleProvisionStore {
  return {
    async findByEmail(email) {
      const row = await database.user.findUnique({
        where: { email: normalizeEmail(email) },
        select: SELECTION,
      });
      return row ? asRecord(row) : null;
    },

    async create({ email, name, passwordHash }) {
      const row = await database.user.create({
        data: {
          email,
          name,
          passwordHash,
          role,
          isActive: true,
        },
        select: SELECTION,
      });
      return asRecord(row);
    },

    async reassertActive(id) {
      const row = await database.user.update({
        where: { id },
        data: { role, isActive: true },
        select: SELECTION,
      });
      return asRecord(row);
    },
  };
}
