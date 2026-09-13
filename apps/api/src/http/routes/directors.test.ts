import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('POST /users/directors', () => {
  let fixture: TestApp;

  beforeEach(async () => {
    fixture = await buildTestApp();
  });

  async function loginAs(
    email: string,
    password: string,
  ): Promise<string | undefined> {
    const response = await request(fixture.app)
      .post('/auth/login')
      .send({ email, password });
    return cookieFrom(response.headers['set-cookie'], SESSION_COOKIE);
  }

  it('rejects anonymous callers', async () => {
    const response = await request(fixture.app)
      .post('/users/directors')
      .send({
        email: 'directora@academia.test',
        password: 'director-password-12',
      });

    expect(response.status).toBe(401);
  });

  it('forbids a DIRECTOR from provisioning another DIRECTOR', async () => {
    fixture.users.seed({
      id: 'dir-1',
      email: 'existing@academia.test',
      name: 'Existing',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });

    const cookie = await loginAs('existing@academia.test', 'director-password-12');
    expect(cookie).toBeDefined();

    const response = await request(fixture.app)
      .post('/users/directors')
      .set('Cookie', cookie!)
      .send({
        email: 'otra@academia.test',
        password: 'director-password-12',
      });

    expect(response.status).toBe(403);
  });

  it('lets SUPER_ADMIN create a DIRECTOR that can log in', async () => {
    fixture.users.seed({
      id: 'sa-1',
      email: 'omegon.info@gmail.com',
      name: 'Omegon',
      role: 'SUPER_ADMIN',
      isActive: true,
      passwordHash: await hashPassword('superadmin-password'),
    });

    const cookie = await loginAs('omegon.info@gmail.com', 'superadmin-password');
    expect(cookie).toBeDefined();

    const created = await request(fixture.app)
      .post('/users/directors')
      .set('Cookie', cookie!)
      .send({
        email: 'Directora@Academia.Test',
        password: 'director-password-12',
        name: 'Ana Directora',
      });

    expect(created.status).toBe(201);
    expect(created.body.user).toEqual({
      id: expect.any(String),
      email: 'directora@academia.test',
      name: 'Ana Directora',
      role: 'DIRECTOR',
    });
    expect(created.body.user).not.toHaveProperty('passwordHash');

    const login = await request(fixture.app).post('/auth/login').send({
      email: 'directora@academia.test',
      password: 'director-password-12',
    });

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('DIRECTOR');
  });

  it('conflicts when the email belongs to another role', async () => {
    fixture.users.seed({
      id: 'sa-1',
      email: 'omegon.info@gmail.com',
      name: 'Omegon',
      role: 'SUPER_ADMIN',
      isActive: true,
      passwordHash: await hashPassword('superadmin-password'),
    });
    fixture.directors.seed({
      id: 'sa-1',
      email: 'omegon.info@gmail.com',
      name: 'Omegon',
      role: 'SUPER_ADMIN',
      isActive: true,
      passwordHash: await hashPassword('superadmin-password'),
    });

    const cookie = await loginAs('omegon.info@gmail.com', 'superadmin-password');

    const response = await request(fixture.app)
      .post('/users/directors')
      .set('Cookie', cookie!)
      .send({
        email: 'omegon.info@gmail.com',
        password: 'director-password-12',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
