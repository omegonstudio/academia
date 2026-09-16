import { randomUUID } from 'node:crypto';
import { GROUP_MAX_ACTIVE_ENROLLMENTS } from '@academia/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Group enrollment', () => {
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
      id: 'director-enr-1',
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
      .send({ name: 'Curso enrollment', courseType: 'REGULAR', serviceType: 'GROUP_120' });
    expect(course.status).toBe(201);
    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: course.body.course.id, name: 'Grupo E' });
    expect(group.status).toBe(201);
    return group.body.group.id as string;
  }

  async function createStudent(
    cookie: string,
    email: string,
  ): Promise<string> {
    const response = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie)
      .send({
        email,
        password: 'student-password-12',
        firstName: 'Ana',
        lastName: 'Pérez',
        level: 'A2',
      });
    expect(response.status).toBe(201);
    return response.body.student.id as string;
  }

  it('rejects anonymous callers with 401', async () => {
    const id = randomUUID();
    expect(
      (await request(fixture.app).get(`/groups/${id}/students`)).status,
    ).toBe(401);
  });

  it('returns 403 without groups permissions', async () => {
    fixture.users.seed({
      id: 'student-enr-1',
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
          .get(`/groups/${randomUUID()}/students`)
          .set('Cookie', cookie!)
      ).status,
    ).toBe(403);
  });

  it('enrolls, lists and unenrolls a student', async () => {
    const cookie = await seedDirector();
    const groupId = await createCourseAndGroup(cookie);
    const studentId = await createStudent(cookie, 'enrolled@academia.test');

    const created = await request(fixture.app)
      .post(`/groups/${groupId}/students`)
      .set('Cookie', cookie)
      .send({ studentId });
    expect(created.status).toBe(201);
    expect(created.body.enrollment.studentId).toBe(studentId);
    expect(created.body.enrollment.groupId).toBe(groupId);
    expect(created.body.enrollment.isActive).toBe(true);

    const listed = await request(fixture.app)
      .get(`/groups/${groupId}/students`)
      .set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.enrollments).toHaveLength(1);

    const removed = await request(fixture.app)
      .delete(`/groups/${groupId}/students/${studentId}`)
      .set('Cookie', cookie);
    expect(removed.status).toBe(204);

    const after = await request(fixture.app)
      .get(`/groups/${groupId}/students`)
      .set('Cookie', cookie);
    expect(after.body.enrollments).toHaveLength(0);
  });

  it('rejects missing/inactive student, missing group, and duplicates', async () => {
    const cookie = await seedDirector();
    const groupId = await createCourseAndGroup(cookie);
    const studentId = await createStudent(cookie, 'dup@academia.test');

    expect(
      (
        await request(fixture.app)
          .post(`/groups/${groupId}/students`)
          .set('Cookie', cookie)
          .send({ studentId: randomUUID() })
      ).status,
    ).toBe(404);

    expect(
      (
        await request(fixture.app)
          .post(`/groups/${randomUUID()}/students`)
          .set('Cookie', cookie)
          .send({ studentId })
      ).status,
    ).toBe(404);

    await request(fixture.app)
      .post(`/groups/${groupId}/students`)
      .set('Cookie', cookie)
      .send({ studentId });

    const duplicate = await request(fixture.app)
      .post(`/groups/${groupId}/students`)
      .set('Cookie', cookie)
      .send({ studentId });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.message).toMatch(/already enrolled/);

    await request(fixture.app)
      .delete(`/students/${studentId}`)
      .set('Cookie', cookie);

    const other = await createStudent(cookie, 'other@academia.test');
    await request(fixture.app)
      .delete(`/groups/${groupId}/students/${studentId}`)
      .set('Cookie', cookie);

    const inactiveStudent = await request(fixture.app)
      .post(`/groups/${groupId}/students`)
      .set('Cookie', cookie)
      .send({ studentId });
    expect(inactiveStudent.status).toBe(400);

    await request(fixture.app)
      .delete(`/groups/${groupId}`)
      .set('Cookie', cookie);

    const inactiveGroup = await request(fixture.app)
      .post(`/groups/${groupId}/students`)
      .set('Cookie', cookie)
      .send({ studentId: other });
    expect(inactiveGroup.status).toBe(400);
  });

  it('allows the 15th enrollment and rejects the 16th', async () => {
    const cookie = await seedDirector();
    const groupId = await createCourseAndGroup(cookie);

    for (let i = 0; i < GROUP_MAX_ACTIVE_ENROLLMENTS; i += 1) {
      const studentId = await createStudent(
        cookie,
        `cap-${i}@academia.test`,
      );
      const response = await request(fixture.app)
        .post(`/groups/${groupId}/students`)
        .set('Cookie', cookie)
        .send({ studentId });
      expect(response.status).toBe(201);
    }

    const listed = await request(fixture.app)
      .get(`/groups/${groupId}/students`)
      .set('Cookie', cookie);
    expect(listed.body.enrollments).toHaveLength(15);

    const overflowId = await createStudent(cookie, 'overflow@academia.test');
    const overflow = await request(fixture.app)
      .post(`/groups/${groupId}/students`)
      .set('Cookie', cookie)
      .send({ studentId: overflowId });
    expect(overflow.status).toBe(400);
    expect(overflow.body.error.code).toBe('BAD_REQUEST');
    expect(overflow.body.error.message).toMatch(/full/);

    const afterOverflow = await request(fixture.app)
      .get(`/groups/${groupId}/students`)
      .set('Cookie', cookie);
    expect(afterOverflow.status).toBe(200);
    expect(afterOverflow.body.enrollments).toHaveLength(15);
    expect(
      afterOverflow.body.enrollments.map(
        (row: { studentId: string }) => row.studentId,
      ),
    ).not.toContain(overflowId);
  });

  it('does not grant TEACHER enrollment mutation without groups.update', async () => {
    const directorCookie = await seedDirector();
    const groupId = await createCourseAndGroup(directorCookie);
    const studentId = await createStudent(
      directorCookie,
      'priv@academia.test',
    );

    fixture.users.seed({
      id: 'teacher-enr-1',
      email: 'docente@academia.test',
      name: 'TEACHER',
      role: 'TEACHER',
      isActive: true,
      passwordHash: await hashPassword('teacher-password-12'),
    });
    const teacherCookie = await loginAs(
      'docente@academia.test',
      'teacher-password-12',
    );

    expect(
      (
        await request(fixture.app)
          .get(`/groups/${groupId}/students`)
          .set('Cookie', teacherCookie!)
      ).status,
    ).toBe(403);

    expect(
      (
        await request(fixture.app)
          .post(`/groups/${groupId}/students`)
          .set('Cookie', teacherCookie!)
          .send({ studentId })
      ).status,
    ).toBe(403);

    expect(
      (
        await request(fixture.app)
          .delete(`/groups/${groupId}/students/${studentId}`)
          .set('Cookie', teacherCookie!)
      ).status,
    ).toBe(403);
  });
});
