import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('POST /users/teachers', () => {
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
      .post('/users/teachers')
      .send({
        email: 'docente@academia.test',
        password: 'teacher-password-12',
      });

    expect(response.status).toBe(401);
  });

  it('forbids ADMINISTRATIVE from provisioning TEACHER', async () => {
    fixture.users.seed({
      id: 'a-1',
      email: 'admin@academia.test',
      name: 'Admin',
      role: 'ADMINISTRATIVE',
      isActive: true,
      passwordHash: await hashPassword('admin-password-12'),
    });

    const cookie = await loginAs('admin@academia.test', 'admin-password-12');

    const response = await request(fixture.app)
      .post('/users/teachers')
      .set('Cookie', cookie!)
      .send({
        email: 'docente@academia.test',
        password: 'teacher-password-12',
      });

    expect(response.status).toBe(403);
  });

  it('lets DIRECTOR create a TEACHER that can log in', async () => {
    fixture.users.seed({
      id: 'd-1',
      email: 'directora@academia.test',
      name: 'Directora',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });

    const cookie = await loginAs('directora@academia.test', 'director-password-12');

    const created = await request(fixture.app)
      .post('/users/teachers')
      .set('Cookie', cookie!)
      .send({
        email: 'Docente@Academia.Test',
        password: 'teacher-password-12',
        name: 'María Docente',
      });

    expect(created.status).toBe(201);
    expect(created.body.user).toEqual({
      id: expect.any(String),
      email: 'docente@academia.test',
      name: 'María Docente',
      role: 'TEACHER',
    });

    const login = await request(fixture.app).post('/auth/login').send({
      email: 'docente@academia.test',
      password: 'teacher-password-12',
    });

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('TEACHER');
  });

  it('lets SUPER_ADMIN create a TEACHER', async () => {
    fixture.users.seed({
      id: 'sa-1',
      email: 'omegon.info@gmail.com',
      name: 'Omegon',
      role: 'SUPER_ADMIN',
      isActive: true,
      passwordHash: await hashPassword('superadmin-password'),
    });

    const cookie = await loginAs('omegon.info@gmail.com', 'superadmin-password');

    const created = await request(fixture.app)
      .post('/users/teachers')
      .set('Cookie', cookie!)
      .send({
        email: 'nueva@academia.test',
        password: 'teacher-password-12',
      });

    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe('TEACHER');
  });

  it('conflicts when the email belongs to another role', async () => {
    fixture.users.seed({
      id: 'd-1',
      email: 'directora@academia.test',
      name: 'Directora',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    fixture.teachers.seed({
      id: 'd-1',
      email: 'directora@academia.test',
      name: 'Directora',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });

    const cookie = await loginAs('directora@academia.test', 'director-password-12');

    const response = await request(fixture.app)
      .post('/users/teachers')
      .set('Cookie', cookie!)
      .send({
        email: 'directora@academia.test',
        password: 'teacher-password-12',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
