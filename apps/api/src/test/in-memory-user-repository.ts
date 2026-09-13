import type {
  AuthenticatableUser,
  UserRepository,
} from '../domain/identity/user-repository.js';
import { normalizeEmail } from '../domain/identity/user-repository.js';

export interface InMemoryUserRepository extends UserRepository {
  seed(user: AuthenticatableUser): void;
  loginTimestamps(): Map<string, Date>;
  getByEmailSync(email: string): AuthenticatableUser | null;
  getByIdSync(id: string): AuthenticatableUser | null;
  upsert(user: AuthenticatableUser): void;
  patch(
    id: string,
    data: Partial<Pick<AuthenticatableUser, 'name' | 'isActive' | 'passwordHash'>>,
  ): void;
}

export function createInMemoryUserRepository(): InMemoryUserRepository {
  const byId = new Map<string, AuthenticatableUser>();
  const logins = new Map<string, Date>();

  function getByEmailSync(email: string): AuthenticatableUser | null {
    const target = normalizeEmail(email);
    for (const user of byId.values()) {
      if (user.email === target) return { ...user };
    }
    return null;
  }

  function getByIdSync(id: string): AuthenticatableUser | null {
    const user = byId.get(id);
    return user ? { ...user } : null;
  }

  return {
    seed(user) {
      byId.set(user.id, { ...user, email: normalizeEmail(user.email) });
    },

    upsert(user) {
      byId.set(user.id, { ...user, email: normalizeEmail(user.email) });
    },

    patch(id, data) {
      const current = byId.get(id);
      if (!current) throw new Error(`user ${id} not found`);
      byId.set(id, { ...current, ...data });
    },

    getByEmailSync,
    getByIdSync,

    loginTimestamps() {
      return logins;
    },

    async findByEmail(email) {
      return getByEmailSync(email);
    },

    async findById(id) {
      return getByIdSync(id);
    },

    async recordLogin(id, at) {
      logins.set(id, at);
    },
  };
}
