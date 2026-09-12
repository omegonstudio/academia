import type { Role, SessionUser } from '@academia/shared';
import type { Database } from '../../lib/prisma.js';

/** A user plus the credential material needed to authenticate them. */
export interface AuthenticatableUser extends SessionUser {
  passwordHash: string;
  isActive: boolean;
}

/**
 * The persistence surface the identity domain depends on.
 *
 * Declared as an interface so the domain does not import Prisma: the auth
 * service is unit-testable against an in-memory implementation.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<AuthenticatableUser | null>;
  findById(id: string): Promise<AuthenticatableUser | null>;
  recordLogin(id: string, at: Date): Promise<void>;
}

/** Emails are compared and stored in one canonical form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const SELECTION = {
  id: true,
  email: true,
  name: true,
  role: true,
  passwordHash: true,
  isActive: true,
} as const;

export function createUserRepository(database: Database): UserRepository {
  return {
    async findByEmail(email) {
      const user = await database.user.findUnique({
        where: { email: normalizeEmail(email) },
        select: SELECTION,
      });
      return user ? { ...user, role: user.role as Role } : null;
    },

    async findById(id) {
      const user = await database.user.findUnique({
        where: { id },
        select: SELECTION,
      });
      return user ? { ...user, role: user.role as Role } : null;
    },

    async recordLogin(id, at) {
      await database.user.update({
        where: { id },
        data: { lastLoginAt: at },
      });
    },
  };
}
