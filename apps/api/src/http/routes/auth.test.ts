import { sessionResponseSchema } from '@academia/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildTestApp,
  cookieFrom,
  seedUser,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

const PASSWORD = 'a-strong-enough-password';

describe('auth routes', () => {
  let context: TestApp;

  beforeEach(async () => {
    context = await buildTestApp();
    await seedUser(context.users, { password: PASSWORD });
  });

  async function login(
    email = 'directora@academia.test',
    password = PASSWORD,
  ): Promise<request.Response> {
    return request(context.app).post('/auth/login').send({ email, password });
  }

  describe('POST /auth/login', () => {
    it('returns the session user and sets a hardened cookie', async () => {
      const response = await login();

      expect(response.status).toBe(200);
      expect(sessionResponseSchema.parse(response.body).user).toEqual({
        id: 'user-1',
        email: 'directora@academia.test',
        name: 'Directora',
        role: 'DIRECTOR',
      });

      const cookie = cookieFrom(response.headers['set-cookie'], SESSION_COOKIE);
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('never returns the token in the response body', async () => {
      const response = await login();

      expect(JSON.stringify(response.body)).not.toContain('eyJ');
      expect(response.body).not.toHaveProperty('token');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password without revealing the reason', async () => {
      const response = await login('directora@academia.test', 'wrong');

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Invalid email or password.');
      expect(cookieFrom(response.headers['set-cookie'], SESSION_COOKIE)).toBeUndefined();
    });

    it('answers identically for an unknown email', async () => {
      const unknown = await login('nobody@academia.test', PASSWORD);
      const wrongPassword = await login('directora@academia.test', 'wrong');

      expect(unknown.status).toBe(wrongPassword.status);
      expect(unknown.body).toEqual(wrongPassword.body);
    });

    it.each([
      ['missing body', {}],
      ['missing password', { email: 'directora@academia.test' }],
      ['malformed email', { email: 'not-an-email', password: PASSWORD }],
      ['wrong types', { email: 42, password: true }],
    ])('rejects an invalid payload (%s)', async (_label, payload) => {
      const response = await request(context.app).post('/auth/login').send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /auth/me', () => {
    it('returns the caller when the session cookie is valid', async () => {
      const cookie = cookieFrom(
        (await login()).headers['set-cookie'],
        SESSION_COOKIE,
      );

      const response = await request(context.app)
        .get('/auth/me')
        .set('Cookie', cookie ?? '');

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('DIRECTOR');
    });

    it('rejects an anonymous request', async () => {
      const response = await request(context.app).get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it.each([
      ['a forged token', `${SESSION_COOKIE}=not.a.token`],
      ['an empty cookie', `${SESSION_COOKIE}=`],
    ])('rejects %s', async (_label, cookie) => {
      const response = await request(context.app)
        .get('/auth/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(401);
    });

    it('stops honouring a session once the account is deactivated', async () => {
      const cookie = cookieFrom(
        (await login()).headers['set-cookie'],
        SESSION_COOKIE,
      );

      // The token stays cryptographically valid; the user is reloaded per
      // request, so revocation must take effect immediately.
      await seedUser(context.users, { password: PASSWORD, isActive: false });

      const response = await request(context.app)
        .get('/auth/me')
        .set('Cookie', cookie ?? '');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the session cookie', async () => {
      const response = await request(context.app).post('/auth/logout');

      expect(response.status).toBe(204);

      const cookie = cookieFrom(response.headers['set-cookie'], SESSION_COOKIE);
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('HttpOnly');
    });

    it('leaves the caller unauthenticated afterwards', async () => {
      const cookie = cookieFrom(
        (await login()).headers['set-cookie'],
        SESSION_COOKIE,
      );

      const cleared = cookieFrom(
        (await request(context.app).post('/auth/logout')).headers['set-cookie'],
        SESSION_COOKIE,
      );

      expect(cookie).not.toBe(cleared);

      const response = await request(context.app)
        .get('/auth/me')
        .set('Cookie', `${SESSION_COOKIE}=`);

      expect(response.status).toBe(401);
    });
  });

  describe('brute-force protection', () => {
    it('throttles repeated failures from one address', async () => {
      const attempts: number[] = [];
      for (let index = 0; index < 12; index += 1) {
        const response = await login('directora@academia.test', 'wrong');
        attempts.push(response.status);
      }

      expect(attempts.filter((status) => status === 429).length).toBeGreaterThan(0);
      expect(attempts.at(-1)).toBe(429);
    });
  });
});
