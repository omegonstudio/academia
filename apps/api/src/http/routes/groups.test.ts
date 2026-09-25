import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Groups CRUD', () => {
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

  async function seedDirector(): Promise<string> {
    fixture.users.seed({
      id: 'director-group-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    return cookie!;
  }

  async function createCourse(cookie: string): Promise<string> {
    const response = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({ name: 'Formación docentes', courseType: 'REGULAR', serviceType: 'GROUP_120' });
    expect(response.status).toBe(201);
    return response.body.course.id as string;
  }

  it('rejects anonymous callers with 401', async () => {
    expect((await request(fixture.app).get('/groups')).status).toBe(401);
  });

  it('returns 403 when STUDENT lacks groups permissions', async () => {
    fixture.users.seed({
      id: 'student-group-1',
      email: 'alumno@academia.test',
      name: 'STUDENT',
      role: 'STUDENT',
      isActive: true,
      passwordHash: await hashPassword('student-password-12'),
    });
    const cookie = await loginAs('alumno@academia.test', 'student-password-12');
    expect(
      (await request(fixture.app).get('/groups').set('Cookie', cookie!)).status,
    ).toBe(403);
  });

  it('lets DIRECTOR create a group under an existing course and manage it', async () => {
    const cookie = await seedDirector();
    const courseId = await createCourse(cookie);

    const created = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId, name: 'Grupo martes' });
    expect(created.status).toBe(201);
    expect(created.body.group).toMatchObject({
      courseId,
      name: 'Grupo martes',
      isActive: true,
    });

    const listed = await request(fixture.app)
      .get('/groups')
      .set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.groups).toHaveLength(1);

    const id = created.body.group.id as string;
    const got = await request(fixture.app)
      .get(`/groups/${id}`)
      .set('Cookie', cookie);
    expect(got.status).toBe(200);

    const patched = await request(fixture.app)
      .patch(`/groups/${id}`)
      .set('Cookie', cookie)
      .send({ name: 'Grupo jueves' });
    expect(patched.status).toBe(200);
    expect(patched.body.group.name).toBe('Grupo jueves');

    const removed = await request(fixture.app)
      .delete(`/groups/${id}`)
      .set('Cookie', cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.group.isActive).toBe(false);
  });

  it('rejects group creation when course does not exist', async () => {
    const cookie = await seedDirector();
    const response = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: randomUUID(), name: 'Huérfano' });
    expect(response.status).toBe(404);
  });

  it('rejects group creation when course is inactive', async () => {
    const cookie = await seedDirector();
    const courseId = await createCourse(cookie);
    await request(fixture.app)
      .delete(`/courses/${courseId}`)
      .set('Cookie', cookie);

    const response = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId, name: 'Sobre inactivo' });
    expect(response.status).toBe(400);
  });
});
