import type { Role } from '@academia/shared';
import { isRole } from '@academia/shared';
import { SignJWT, jwtVerify } from 'jose';

export interface SessionClaims {
  userId: string;
  role: Role;
}

export interface SessionCodec {
  issue(claims: SessionClaims): Promise<string>;
  verify(token: string): Promise<SessionClaims | null>;
}

const ALGORITHM = 'HS256';
const ISSUER = 'academia';

/**
 * Signed, stateless session tokens.
 *
 * The role travels inside the signed payload only as a hint for cheap checks;
 * every authenticated request still reloads the user, so a role revoked in the
 * database takes effect immediately instead of at token expiry.
 */
export function createSessionCodec(
  secret: string,
  ttlSeconds: number,
): SessionCodec {
  const key = new TextEncoder().encode(secret);

  return {
    async issue(claims) {
      const now = Math.floor(Date.now() / 1000);

      return new SignJWT({ role: claims.role })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(claims.userId)
        .setIssuer(ISSUER)
        .setIssuedAt(now)
        .setExpirationTime(now + ttlSeconds)
        .sign(key);
    },

    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ALGORITHM],
          issuer: ISSUER,
        });

        if (!payload.sub || !isRole(payload['role'])) return null;

        return { userId: payload.sub, role: payload['role'] };
      } catch {
        return null;
      }
    },
  };
}
