import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

/**
 * Positive ADMINISTRATIVE RolePermission grants for academy modules.
 *
 * Stage 1 matrix already covers users/permissions grants and denials without
 * grants. This suite closes the smoke gap: Administrative + grant → allowed
 * on students/teachers/courses/groups/classes (incl. attendance & notes).
 */
describe('ADMINISTRATIVE academy module grants', () => {
  let fixture: TestApp;
  let adminCookie: string;
  let directorCookie: string;

  beforeEach(async () => {
    fixture = await buildTestApp();

    fixture.users.seed({
      id: 'director-admin-grants',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    fixture.users.seed({
      id: 'admin-academy-grants',
      email: 'admin@academia.test',
      name: 'ADMINISTRATIVE',
      role: 'ADMINISTRATIVE',
      isActive: true,
      passwordHash: await hashPassword('admin-password-12'),
    });

    const directorLogin = await request(fixture.app)
      .post('/auth/login')
      .send({ email: 'directora@academia.test', password: 'director-password-12' });
    directorCookie = cookieFrom(
      directorLogin.headers['set-cookie'],
      SESSION_COOKIE,
    )!;

    const adminLogin = await request(fixture.app)
      .post('/auth/login')
      .send({ email: 'admin@academia.test', password: 'admin-password-12' });
    adminCookie = cookieFrom(
      adminLogin.headers['set-cookie'],
      SESSION_COOKIE,
    )!;
  });

  async function seedClassContext(): Promise<{
    groupId: string;
    studentId: string;
    classSessionId: string;
  }> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', directorCookie)
      .send({
        name: 'Admin grants course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', directorCookie)
      .send({ courseId: course.body.course.id, name: 'Admin grants group' });
    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', directorCookie)
      .send({
        email: 'teacher-admin-grants@academia.test',
        password: 'teacher-password-12',
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'C1',
      });
    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/teacher`)
      .set('Cookie', directorCookie)
      .send({ teacherId: teacher.body.teacher.id });
    const option = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', directorCookie)
      .send({ day: 'MONDAY', startTime: '18:00', endTime: '20:00' });
    await request(fixture.app)
      .patch(`/groups/${group.body.group.id}`)
      .set('Cookie', directorCookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });
    const student = await request(fixture.app)
      .post('/students')
      .set('Cookie', directorCookie)
      .send({
        email: 'student-admin-grants@academia.test',
        password: 'student-password-12',
        firstName: 'Ana',
        lastName: 'Pérez',
        level: 'A2',
      });
    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/students`)
      .set('Cookie', directorCookie)
      .send({ studentId: student.body.student.id });
    const session = await request(fixture.app)
      .post('/classes')
      .set('Cookie', directorCookie)
      .send({
        groupId: group.body.group.id,
        startAt: '2026-09-21T21:00:00.000Z',
      });
    expect(session.status).toBe(201);

    return {
      groupId: group.body.group.id as string,
      studentId: student.body.student.id as string,
      classSessionId: session.body.classSession.id as string,
    };
  }

  it('denies academy reads/writes without grants', async () => {
    fixture.administrativePermissions.clear();

    expect(
      (
        await request(fixture.app)
          .get('/students')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(fixture.app)
          .get('/teachers')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(fixture.app)
          .get('/courses')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);
    expect(
      (await request(fixture.app).get('/groups').set('Cookie', adminCookie))
        .status,
    ).toBe(403);
    expect(
      (
        await request(fixture.app)
          .get('/classes')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);
  });

  it('allows students module when granted', async () => {
    fixture.administrativePermissions.clear();

    expect(
      (
        await request(fixture.app)
          .get('/students')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);

    await fixture.administrativePermissions.grant('students', 'read');
    expect(
      (
        await request(fixture.app)
          .get('/students')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);

    await fixture.administrativePermissions.grant('students', 'create');
    const created = await request(fixture.app)
      .post('/students')
      .set('Cookie', adminCookie)
      .send({
        email: 'admin-created-student@academia.test',
        password: 'student-password-12',
        firstName: 'Luis',
        lastName: 'Grant',
        level: 'B1',
      });
    expect(created.status).toBe(201);
  });

  it('allows teachers module when granted', async () => {
    fixture.administrativePermissions.clear();

    expect(
      (
        await request(fixture.app)
          .get('/teachers')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);

    await fixture.administrativePermissions.grant('teachers', 'read');
    expect(
      (
        await request(fixture.app)
          .get('/teachers')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);

    await fixture.administrativePermissions.grant('teachers', 'create');
    const created = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', adminCookie)
      .send({
        email: 'admin-created-teacher@academia.test',
        password: 'teacher-password-12',
        firstName: 'Mia',
        lastName: 'Grant',
        level: 'C1',
      });
    expect(created.status).toBe(201);
  });

  it('allows courses module when granted', async () => {
    fixture.administrativePermissions.clear();

    expect(
      (
        await request(fixture.app)
          .get('/courses')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);

    await fixture.administrativePermissions.grant('courses', 'read');
    expect(
      (
        await request(fixture.app)
          .get('/courses')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);

    await fixture.administrativePermissions.grant('courses', 'create');
    const created = await request(fixture.app)
      .post('/courses')
      .set('Cookie', adminCookie)
      .send({
        name: 'Admin course',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
      });
    expect(created.status).toBe(201);
    expect(created.body.course.durationMinutes).toBe(60);
  });

  it('allows groups module when granted', async () => {
    fixture.administrativePermissions.clear();

    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', directorCookie)
      .send({
        name: 'Group grants course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });

    expect(
      (await request(fixture.app).get('/groups').set('Cookie', adminCookie))
        .status,
    ).toBe(403);

    await fixture.administrativePermissions.grant('groups', 'read');
    expect(
      (await request(fixture.app).get('/groups').set('Cookie', adminCookie))
        .status,
    ).toBe(200);

    await fixture.administrativePermissions.grant('groups', 'create');
    const created = await request(fixture.app)
      .post('/groups')
      .set('Cookie', adminCookie)
      .send({
        courseId: course.body.course.id,
        name: 'Admin group',
      });
    expect(created.status).toBe(201);
  });

  it('allows classes read/create and attendance/notes via classes.update when granted', async () => {
    fixture.administrativePermissions.clear();
    const ctx = await seedClassContext();

    expect(
      (
        await request(fixture.app)
          .get('/classes')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(fixture.app)
          .get(`/classes/${ctx.classSessionId}/attendance`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(fixture.app)
          .get(`/classes/${ctx.classSessionId}/notes`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);

    await fixture.administrativePermissions.grant('classes', 'read');
    expect(
      (
        await request(fixture.app)
          .get('/classes')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(fixture.app)
          .get(`/classes/${ctx.classSessionId}/attendance`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(fixture.app)
          .get(`/classes/${ctx.classSessionId}/notes`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);

    await fixture.administrativePermissions.grant('classes', 'create');
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', adminCookie)
      .send({
        groupId: ctx.groupId,
        startAt: '2026-09-28T21:00:00.000Z',
      });
    expect(created.status).toBe(201);

    expect(
      (
        await request(fixture.app)
          .post(`/classes/${ctx.classSessionId}/attendance`)
          .set('Cookie', adminCookie)
          .send({ studentId: ctx.studentId, status: 'PRESENT' })
      ).status,
    ).toBe(403);

    await fixture.administrativePermissions.grant('classes', 'update');
    const attendance = await request(fixture.app)
      .post(`/classes/${ctx.classSessionId}/attendance`)
      .set('Cookie', adminCookie)
      .send({ studentId: ctx.studentId, status: 'PRESENT' });
    expect(attendance.status).toBe(201);

    const note = await request(fixture.app)
      .post(`/classes/${ctx.classSessionId}/notes`)
      .set('Cookie', adminCookie)
      .send({ content: 'Admin note via classes.update' });
    expect(note.status).toBe(201);
  });
});
