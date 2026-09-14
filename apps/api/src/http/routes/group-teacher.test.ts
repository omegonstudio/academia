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

describe('Group teacher assignment', () => {
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
      id: 'director-gt-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  async function createCourseAndGroup(cookie: string): Promise<string> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({ name: 'Curso grupo', courseType: 'REGULAR', serviceType: 'GROUP_120' });
    expect(course.status).toBe(201);
    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: course.body.course.id, name: 'Grupo A' });
    expect(group.status).toBe(201);
    expect(group.body.group.teacherId).toBeNull();
    return group.body.group.id as string;
  }

  async function createTeacher(
    cookie: string,
    email: string,
  ): Promise<string> {
    const response = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email,
        password: 'teacher-password-12',
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'C1',
      });
    expect(response.status).toBe(201);
    return response.body.teacher.id as string;
  }

  it('rejects anonymous callers with 401', async () => {
    const id = randomUUID();
    expect(
      (await request(fixture.app).get(`/groups/${id}/teacher`)).status,
    ).toBe(401);
  });

  it('returns 403 without groups permissions', async () => {
    fixture.users.seed({
      id: 'student-gt-1',
      email: 'alumno@academia.test',
      name: 'STUDENT',
      role: 'STUDENT',
      isActive: true,
      passwordHash: await hashPassword('student-password-12'),
    });
    const cookie = await loginAs('alumno@academia.test', 'student-password-12');
    expect(
      (
        await request(fixture.app)
          .get(`/groups/${randomUUID()}/teacher`)
          .set('Cookie', cookie!)
      ).status,
    ).toBe(403);
  });

  it('assigns, reads, replaces and unassigns a teacher', async () => {
    const cookie = await seedDirector();
    const groupId = await createCourseAndGroup(cookie);
    const teacherA = await createTeacher(cookie, 'a@academia.test');
    const teacherB = await createTeacher(cookie, 'b@academia.test');

    const assigned = await request(fixture.app)
      .post(`/groups/${groupId}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: teacherA });
    expect(assigned.status).toBe(200);
    expect(assigned.body).toEqual({ groupId, teacherId: teacherA });

    const got = await request(fixture.app)
      .get(`/groups/${groupId}/teacher`)
      .set('Cookie', cookie);
    expect(got.status).toBe(200);
    expect(got.body.teacherId).toBe(teacherA);

    const replaced = await request(fixture.app)
      .post(`/groups/${groupId}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: teacherB });
    expect(replaced.status).toBe(200);
    expect(replaced.body.teacherId).toBe(teacherB);

    const group = await request(fixture.app)
      .get(`/groups/${groupId}`)
      .set('Cookie', cookie);
    expect(group.body.group.teacherId).toBe(teacherB);

    const removed = await request(fixture.app)
      .delete(`/groups/${groupId}/teacher`)
      .set('Cookie', cookie);
    expect(removed.status).toBe(204);
  });

  it('rejects missing/inactive teacher and missing group', async () => {
    const cookie = await seedDirector();
    const groupId = await createCourseAndGroup(cookie);
    const teacherId = await createTeacher(cookie, 't@academia.test');

    expect(
      (
        await request(fixture.app)
          .post(`/groups/${groupId}/teacher`)
          .set('Cookie', cookie)
          .send({ teacherId: randomUUID() })
      ).status,
    ).toBe(404);

    await request(fixture.app)
      .delete(`/teachers/${teacherId}`)
      .set('Cookie', cookie);
    expect(
      (
        await request(fixture.app)
          .post(`/groups/${groupId}/teacher`)
          .set('Cookie', cookie)
          .send({ teacherId })
      ).status,
    ).toBe(400);

    expect(
      (
        await request(fixture.app)
          .post(`/groups/${randomUUID()}/teacher`)
          .set('Cookie', cookie)
          .send({ teacherId })
      ).status,
    ).toBe(404);
  });

  it('allows a TEACHER with groups.update to assign themselves to a group', async () => {
    const directorCookie = await seedDirector();
    const groupId = await createCourseAndGroup(directorCookie);
    const teacherId = await createTeacher(
      directorCookie,
      'self@academia.test',
    );

    fixture.administrativePermissions.grantRole('TEACHER', 'groups', 'update');
    fixture.administrativePermissions.grantRole('TEACHER', 'groups', 'read');

    const teacherCookie = await loginAs(
      'self@academia.test',
      'teacher-password-12',
    );
    const response = await request(fixture.app)
      .post(`/groups/${groupId}/teacher`)
      .set('Cookie', teacherCookie!)
      .send({ teacherId });
    expect(response.status).toBe(200);
    expect(response.body.teacherId).toBe(teacherId);
  });
});
