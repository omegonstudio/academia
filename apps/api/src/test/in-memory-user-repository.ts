import type {
  AuthenticatableUser,
  UserRepository,
} from '../domain/identity/user-repository.js';
import { normalizeEmail } from '../domain/identity/user-repository.js';

export interface InMemoryUserRepository extends UserRepository {
  seed(user: AuthenticatableUser): void;
  loginTimestamps(): Map<string, Date>;
}

/**
 * Test double for the identity domain.
 *
 * Exists so authentication rules can be verified without a database, which
 * keeps the unit suite runnable in CI before any service container is up.
 */
export function createInMemoryUserRepository(): InMemoryUserRepository {
  const byId = new Map<string, AuthenticatableUser>();
  const logins = new Map<string, Date>();

  return {
    seed(user) {
      byId.set(user.id, { ...user, email: normalizeEmail(user.email) });
    },

    loginTimestamps() {
      return logins;
    },

    async findByEmail(email) {
      const target = normalizeEmail(email);
      for (const user of byId.values()) {
        if (user.email === target) return { ...user };
      }
      return null;
    },

    async findById(id) {
      const user = byId.get(id);
      return user ? { ...user } : null;
    },

    async recordLogin(id, at) {
      logins.set(id, at);
    },
  };
}
