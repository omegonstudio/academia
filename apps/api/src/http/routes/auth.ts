import { loginRequestSchema, type SessionResponse } from '@academia/shared';
import { Router } from 'express';
import type { AuthService } from '../../domain/identity/auth-service.js';
import type { SessionCodec } from '../../domain/identity/session.js';
import { serializeCookie } from '../../lib/cookies.js';
import { BadRequestError, UnauthorizedError } from '../errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { rateLimit } from '../middleware/rate-limit.js';

export interface SessionCookieSettings {
  name: string;
  /** Set only over HTTPS; disabled in local development. */
  secure: boolean;
  ttlSeconds: number;
}

export interface AuthDependencies {
  authService: AuthService;
  sessionCodec: SessionCodec;
  cookie: SessionCookieSettings;
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

/**
 * Session endpoints.
 *
 * The session lives in an HttpOnly cookie so the token is unreachable from
 * JavaScript. The client is never given the token to store itself.
 */
export function createAuthRouter({
  authService,
  sessionCodec,
  cookie,
}: AuthDependencies): Router {
  const router = Router();

  router.post(
    '/auth/login',
    rateLimit({ windowMs: LOGIN_WINDOW_MS, maxAttempts: LOGIN_MAX_ATTEMPTS }),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = loginRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('A valid email and password are required.');
          }

          const user = await authService.authenticate(
            parsed.data.email,
            parsed.data.password,
          );

          // One message for every failure mode: wrong password, unknown email
          // and deactivated account are indistinguishable to the caller.
          if (!user) {
            throw new UnauthorizedError('Invalid email or password.');
          }

          const token = await sessionCodec.issue({
            userId: user.id,
            role: user.role,
          });

          res.setHeader(
            'Set-Cookie',
            serializeCookie(cookie.name, token, {
              maxAgeSeconds: cookie.ttlSeconds,
              secure: cookie.secure,
              httpOnly: true,
              sameSite: 'Lax',
            }),
          );

          const body: SessionResponse = { user };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post('/auth/logout', (_req, res) => {
    res.setHeader(
      'Set-Cookie',
      serializeCookie(cookie.name, '', {
        maxAgeSeconds: 0,
        secure: cookie.secure,
        httpOnly: true,
        sameSite: 'Lax',
      }),
    );

    res.status(204).end();
  });

  router.get(
    '/auth/me',
    authenticate({ authService, sessionCodec, cookieName: cookie.name }),
    (req, res) => {
      // `authenticate` guarantees req.user is present.
      const body: SessionResponse = { user: req.user! };
      res.status(200).json(body);
    },
  );

  return router;
}
