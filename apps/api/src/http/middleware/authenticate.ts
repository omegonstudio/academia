import type { Role } from '@academia/shared';
import type { RequestHandler } from 'express';
import type { AuthService } from '../../domain/identity/auth-service.js';
import type { SessionCodec } from '../../domain/identity/session.js';
import { parseCookies } from '../../lib/cookies.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';

export interface AuthenticateOptions {
  authService: AuthService;
  sessionCodec: SessionCodec;
  cookieName: string;
}

/**
 * Resolves the caller from the session cookie.
 *
 * The user is reloaded from the database on every request rather than trusted
 * from the token, so deactivation and role changes apply immediately.
 */
export function authenticate({
  authService,
  sessionCodec,
  cookieName,
}: AuthenticateOptions): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      try {
        const token = parseCookies(req.headers.cookie)[cookieName];
        if (!token) throw new UnauthorizedError();

        const claims = await sessionCodec.verify(token);
        if (!claims) throw new UnauthorizedError('Session is invalid or expired.');

        const user = await authService.loadActiveUser(claims.userId);
        if (!user) throw new UnauthorizedError('Session is no longer valid.');

        req.user = user;
        next();
      } catch (error) {
        next(error);
      }
    })();
  };
}

/**
 * Restricts a route to the given roles.
 *
 * Must always be mounted after `authenticate`; it reads the server-resolved
 * user and never a client-supplied role.
 */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowed.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
