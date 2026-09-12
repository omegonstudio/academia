import type { SessionUser } from '@academia/shared';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import type { AuthenticatableUser, UserRepository } from './user-repository.js';

export interface AuthService {
  authenticate(email: string, password: string): Promise<SessionUser | null>;
  loadActiveUser(id: string): Promise<SessionUser | null>;
}

function toSessionUser(user: AuthenticatableUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * A hash computed once at startup and verified against whenever no user
 * matches. Without it, a missing account would return measurably faster than a
 * wrong password and leak which emails are registered.
 */
const decoyHash = hashPassword('decoy-comparison-target');

export function createAuthService(users: UserRepository): AuthService {
  return {
    async authenticate(email, password) {
      const user = await users.findByEmail(email);

      if (!user) {
        await verifyPassword(password, await decoyHash);
        return null;
      }

      const passwordMatches = await verifyPassword(password, user.passwordHash);

      // Checked after the comparison so a deactivated account is not
      // distinguishable from a wrong password by response time.
      if (!passwordMatches || !user.isActive) return null;

      await users.recordLogin(user.id, new Date());

      return toSessionUser(user);
    },

    async loadActiveUser(id) {
      const user = await users.findById(id);
      if (!user || !user.isActive) return null;
      return toSessionUser(user);
    },
  };
}
