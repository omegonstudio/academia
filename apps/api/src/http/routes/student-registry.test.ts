import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Student registry CRUD', () => {
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
    const list = await request(fixture.app).get('/students');
    expect(list.status).toBe(401);

    const create = await request(fixture.app).post('/students').send({
      email: 'a@academia.test',
      password: 'student-password-12',
      firstName: 'Ana',
      lastName: 'Pérez',
      level: 'A1',
    });
    expect(create.status).toBe(401);
  });

  it('returns 403 when TEACHER lacks students permissions', async () => {
    await seedRole('TEACHER', 'docente@academia.test', 'teacher-password-12');
    const cookie = await loginAs('docente@academia.test', 'teacher-password-12');

    const list = await request(fixture.app)
      .get('/students')
      .set('Cookie', cookie!);
    expect(list.status).toBe(403);

    const create = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie!)
      .send({
        email: 'a@academia.test',
        password: 'student-password-12',
        firstName: 'Ana',
        lastName: 'Pérez',
        level: 'A1',
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
      .post('/students')
      .set('Cookie', cookie!)
      .send({
        email: 'Lucia@Academia.Test',
        password: 'student-password-12',
        firstName: 'Lucía',
        lastName: 'García',
        level: 'B1',
      });

    expect(created.status).toBe(201);
    expect(created.body.student).toMatchObject({
      email: 'lucia@academia.test',
      firstName: 'Lucía',
      lastName: 'García',
      level: 'B1',
      isActive: true,
    });
    expect(created.body.student).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(created.body)).not.toMatch(/password/i);

    const listed = await request(fixture.app)
      .get('/students')
      .set('Cookie', cookie!);
    expect(listed.status).toBe(200);
    expect(listed.body.students).toHaveLength(1);

    const id = created.body.student.id as string;
    const got = await request(fixture.app)
      .get(`/students/${id}`)
      .set('Cookie', cookie!);
    expect(got.status).toBe(200);
    expect(got.body.student.id).toBe(id);

    const patched = await request(fixture.app)
      .patch(`/students/${id}`)
      .set('Cookie', cookie!)
      .send({ level: 'B2' });
    expect(patched.status).toBe(200);
    expect(patched.body.student.level).toBe('B2');

    const removed = await request(fixture.app)
      .delete(`/students/${id}`)
      .set('Cookie', cookie!);
    expect(removed.status).toBe(200);
    expect(removed.body.student.isActive).toBe(false);
  });

  it('rejects invalid create payloads with 400', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const response = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie!)
      .send({
        email: 'not-an-email',
        firstName: 'Ana',
        lastName: 'Pérez',
        level: 'Z9',
      });

    expect(response.status).toBe(400);
  });

  it('allows a STUDENT to read own profile but not another', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const directorCookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const first = await request(fixture.app)
      .post('/students')
      .set('Cookie', directorCookie!)
      .send({
        email: 'one@academia.test',
        password: 'student-password-12',
        firstName: 'Uno',
        lastName: 'Estudiante',
        level: 'A1',
      });
    const second = await request(fixture.app)
      .post('/students')
      .set('Cookie', directorCookie!)
      .send({
        email: 'two@academia.test',
        password: 'student-password-12',
        firstName: 'Dos',
        lastName: 'Estudiante',
        level: 'A2',
      });

    const ownCookie = await loginAs('one@academia.test', 'student-password-12');
    const own = await request(fixture.app)
      .get(`/students/${first.body.student.id}`)
      .set('Cookie', ownCookie!);
    expect(own.status).toBe(200);

    const other = await request(fixture.app)
      .get(`/students/${second.body.student.id}`)
      .set('Cookie', ownCookie!);
    expect(other.status).toBe(403);

    const list = await request(fixture.app)
      .get('/students')
      .set('Cookie', ownCookie!);
    expect(list.status).toBe(403);

    const patch = await request(fixture.app)
      .patch(`/students/${first.body.student.id}`)
      .set('Cookie', ownCookie!)
      .send({ level: 'B1' });
    expect(patch.status).toBe(403);
  });

  it('ignores client-supplied permission claims', async () => {
    await seedRole('STUDENT', 'solo@academia.test', 'student-password-12');
    const cookie = await loginAs('solo@academia.test', 'student-password-12');

    const response = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie!)
      .set('x-permissions', 'students:create')
      .send({
        email: 'nuevo@academia.test',
        password: 'student-password-12',
        firstName: 'Nuevo',
        lastName: 'Alumno',
        level: 'A1',
        permissions: [{ module: 'students', action: 'create' }],
      });

    expect(response.status).toBe(403);
  });
});
