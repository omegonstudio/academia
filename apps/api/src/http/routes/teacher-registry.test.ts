import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Teacher registry CRUD', () => {
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

  async function seedRole(
    role: 'SUPER_ADMIN' | 'DIRECTOR' | 'ADMINISTRATIVE' | 'TEACHER' | 'STUDENT',
    email: string,
    password: string,
    id = `${role.toLowerCase()}-1`,
  ): Promise<void> {
    fixture.users.seed({
      id,
      email,
      name: role,
      role,
      isActive: true,
      passwordHash: await hashPassword(password),
    });
  }

  it('rejects anonymous callers with 401', async () => {
    const list = await request(fixture.app).get('/teachers');
    expect(list.status).toBe(401);

    const create = await request(fixture.app).post('/teachers').send({
      email: 'a@academia.test',
      password: 'teacher-password-12',
      firstName: 'Eva',
      lastName: 'Ruiz',
      level: 'C1',
    });
    expect(create.status).toBe(401);
  });

  it('returns 403 when STUDENT lacks teachers permissions', async () => {
    await seedRole('STUDENT', 'alumno@academia.test', 'student-password-12');
    const cookie = await loginAs('alumno@academia.test', 'student-password-12');

    const list = await request(fixture.app)
      .get('/teachers')
      .set('Cookie', cookie!);
    expect(list.status).toBe(403);

    const create = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie!)
      .send({
        email: 'a@academia.test',
        password: 'teacher-password-12',
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'C1',
      });
    expect(create.status).toBe(403);
  });

  it('lets DIRECTOR create, list, read, update and soft-delete', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const created = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie!)
      .send({
        email: 'Eva@Academia.Test',
        password: 'teacher-password-12',
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'C1',
        availability: 'AVAILABLE',
      });

    expect(created.status).toBe(201);
    expect(created.body.teacher).toMatchObject({
      email: 'eva@academia.test',
      firstName: 'Eva',
      lastName: 'Ruiz',
      level: 'C1',
      availability: 'AVAILABLE',
      isActive: true,
    });
    expect(created.body.teacher).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(created.body)).not.toMatch(/password/i);

    const listed = await request(fixture.app)
      .get('/teachers')
      .set('Cookie', cookie!);
    expect(listed.status).toBe(200);
    expect(listed.body.teachers).toHaveLength(1);

    const id = created.body.teacher.id as string;
    const got = await request(fixture.app)
      .get(`/teachers/${id}`)
      .set('Cookie', cookie!);
    expect(got.status).toBe(200);
    expect(got.body.teacher.id).toBe(id);

    const patched = await request(fixture.app)
      .patch(`/teachers/${id}`)
      .set('Cookie', cookie!)
      .send({ availability: 'LIMITED', level: 'C2' });
    expect(patched.status).toBe(200);
    expect(patched.body.teacher.availability).toBe('LIMITED');
    expect(patched.body.teacher.level).toBe('C2');
    expect(patched.body.teacher.isActive).toBe(true);

    const removed = await request(fixture.app)
      .delete(`/teachers/${id}`)
      .set('Cookie', cookie!);
    expect(removed.status).toBe(200);
    expect(removed.body.teacher.isActive).toBe(false);
  });

  it('rejects invalid create payloads with 400', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const response = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie!)
      .send({
        email: 'not-an-email',
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'Z9',
        availability: 'MAYBE',
      });

    expect(response.status).toBe(400);
  });

  it('allows a TEACHER to read own profile but not another', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const directorCookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const first = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', directorCookie!)
      .send({
        email: 'one@academia.test',
        password: 'teacher-password-12',
        firstName: 'Uno',
        lastName: 'Docente',
        level: 'B2',
      });
    const second = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', directorCookie!)
      .send({
        email: 'two@academia.test',
        password: 'teacher-password-12',
        firstName: 'Dos',
        lastName: 'Docente',
        level: 'C1',
      });

    const ownCookie = await loginAs('one@academia.test', 'teacher-password-12');
    const own = await request(fixture.app)
      .get(`/teachers/${first.body.teacher.id}`)
      .set('Cookie', ownCookie!);
    expect(own.status).toBe(200);

    const other = await request(fixture.app)
      .get(`/teachers/${second.body.teacher.id}`)
      .set('Cookie', ownCookie!);
    expect(other.status).toBe(403);

    const list = await request(fixture.app)
      .get('/teachers')
      .set('Cookie', ownCookie!);
    expect(list.status).toBe(403);

    const patch = await request(fixture.app)
      .patch(`/teachers/${first.body.teacher.id}`)
      .set('Cookie', ownCookie!)
      .send({ availability: 'UNAVAILABLE' });
    expect(patch.status).toBe(403);
  });

  it('ignores client-supplied permission claims', async () => {
    await seedRole('STUDENT', 'solo@academia.test', 'student-password-12');
    const cookie = await loginAs('solo@academia.test', 'student-password-12');

    const response = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie!)
      .set('x-permissions', 'teachers:create')
      .send({
        email: 'nuevo@academia.test',
        password: 'teacher-password-12',
        firstName: 'Nuevo',
        lastName: 'Docente',
        level: 'B1',
        permissions: [{ module: 'teachers', action: 'create' }],
      });

    expect(response.status).toBe(403);
  });
});
