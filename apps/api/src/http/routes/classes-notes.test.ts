import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('ClassSession notes', () => {
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
      id: 'director-notes-1',
      email: 'directora-notes@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs(
      'directora-notes@academia.test',
      'director-password-12',
    ))!;
  }

  async function seedReadyClass(cookie: string): Promise<{
    classSessionId: string;
    otherSessionId: string;
    teacherCookie: string;
    otherTeacherCookie: string;
    studentCookie: string;
    outsiderStudentCookie: string;
  }> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Notes Course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({
        courseId: course.body.course.id,
        name: 'Notes Group',
      });
    expect(group.status).toBe(201);

    const otherGroup = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({
        courseId: course.body.course.id,
        name: 'Notes Other Group',
      });
    expect(otherGroup.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: 'teacher-notes@academia.test',
        password: 'teacher-password-12',
        firstName: 'Tea',
        lastName: 'Cher',
        level: 'C1',
      });
    expect(teacher.status).toBe(201);

    const otherTeacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: 'teacher-other-notes@academia.test',
        password: 'teacher-password-12',
        firstName: 'Other',
        lastName: 'Teacher',
        level: 'C1',
      });
    expect(otherTeacher.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: teacher.body.teacher.id });
    await request(fixture.app)
      .post(`/groups/${otherGroup.body.group.id}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: otherTeacher.body.teacher.id });

    const option = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', cookie)
      .send({ day: 'WEDNESDAY', startTime: '16:00', endTime: '18:00' });
    expect(option.status).toBe(201);

    await request(fixture.app)
      .patch(`/groups/${group.body.group.id}`)
      .set('Cookie', cookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });
    await request(fixture.app)
      .patch(`/groups/${otherGroup.body.group.id}`)
      .set('Cookie', cookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });

    const session = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId: group.body.group.id,
        startAt: '2026-09-16T19:00:00.000Z',
      });
    expect(session.status).toBe(201);

    const otherSession = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId: otherGroup.body.group.id,
        startAt: '2026-09-16T21:00:00.000Z',
      });
    expect(otherSession.status).toBe(201);

    const student = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie)
      .send({
        email: 'student-notes@academia.test',
        password: 'student-password-12',
        firstName: 'Stu',
        lastName: 'Dent',
        level: 'B1',
      });
    expect(student.status).toBe(201);

    const outsider = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie)
      .send({
        email: 'outsider-notes@academia.test',
        password: 'student-password-12',
        firstName: 'Out',
        lastName: 'Sider',
        level: 'A1',
      });
    expect(outsider.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/students`)
      .set('Cookie', cookie)
      .send({ studentId: student.body.student.id });

    return {
      classSessionId: session.body.classSession.id as string,
      otherSessionId: otherSession.body.classSession.id as string,
      teacherCookie: (await loginAs(
        'teacher-notes@academia.test',
        'teacher-password-12',
      ))!,
      otherTeacherCookie: (await loginAs(
        'teacher-other-notes@academia.test',
        'teacher-password-12',
      ))!,
      studentCookie: (await loginAs(
        'student-notes@academia.test',
        'student-password-12',
      ))!,
      outsiderStudentCookie: (await loginAs(
        'outsider-notes@academia.test',
        'student-password-12',
      ))!,
    };
  }

  it('lets admin create, list, update and delete notes', async () => {
    const director = await seedDirector();
    const ready = await seedReadyClass(director);

    const empty = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', director)
      .send({ content: '   ' });
    expect(empty.status).toBe(400);

    const created = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', director)
      .send({ content: 'Warm-up vocabulary' });
    expect(created.status).toBe(201);
    expect(created.body.note.content).toBe('Warm-up vocabulary');

    const listed = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', director);
    expect(listed.status).toBe(200);
    expect(listed.body.notes).toHaveLength(1);

    const patched = await request(fixture.app)
      .patch(`/classes/${ready.classSessionId}/notes/${created.body.note.id}`)
      .set('Cookie', director)
      .send({ content: 'Warm-up + review' });
    expect(patched.status).toBe(200);
    expect(patched.body.note.content).toBe('Warm-up + review');

    const deleted = await request(fixture.app)
      .delete(`/classes/${ready.classSessionId}/notes/${created.body.note.id}`)
      .set('Cookie', director);
    expect(deleted.status).toBe(204);

    const after = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', director);
    expect(after.body.notes).toHaveLength(0);
  });

  it('enforces teacher ownership and student read-only access', async () => {
    const director = await seedDirector();
    const ready = await seedReadyClass(director);

    const byTeacher = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', ready.teacherCookie)
      .send({ content: 'Teacher note' });
    expect(byTeacher.status).toBe(201);

    const foreignWrite = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', ready.otherTeacherCookie)
      .send({ content: 'No' });
    expect(foreignWrite.status).toBe(403);

    const studentRead = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', ready.studentCookie);
    expect(studentRead.status).toBe(200);
    expect(studentRead.body.notes).toHaveLength(1);

    const outsiderRead = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', ready.outsiderStudentCookie);
    expect(outsiderRead.status).toBe(403);

    const studentWrite = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', ready.studentCookie)
      .send({ content: 'Student cannot write' });
    expect(studentWrite.status).toBe(403);

    const studentPatch = await request(fixture.app)
      .patch(
        `/classes/${ready.classSessionId}/notes/${byTeacher.body.note.id}`,
      )
      .set('Cookie', ready.studentCookie)
      .send({ content: 'Nope' });
    expect(studentPatch.status).toBe(403);

    const studentDelete = await request(fixture.app)
      .delete(
        `/classes/${ready.classSessionId}/notes/${byTeacher.body.note.id}`,
      )
      .set('Cookie', ready.studentCookie);
    expect(studentDelete.status).toBe(403);
  });

  it('rejects missing notes and cross-session note ids', async () => {
    const director = await seedDirector();
    const ready = await seedReadyClass(director);

    const note = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', director)
      .send({ content: 'Session A note' });
    expect(note.status).toBe(201);

    const missing = await request(fixture.app)
      .patch(
        `/classes/${ready.classSessionId}/notes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      )
      .set('Cookie', director)
      .send({ content: 'Missing' });
    expect(missing.status).toBe(404);

    const cross = await request(fixture.app)
      .patch(
        `/classes/${ready.otherSessionId}/notes/${note.body.note.id}`,
      )
      .set('Cookie', director)
      .send({
        content: 'Hijack',
        classSessionId: ready.otherSessionId,
      });
    expect(cross.status).toBe(404);

    const crossDelete = await request(fixture.app)
      .delete(
        `/classes/${ready.otherSessionId}/notes/${note.body.note.id}`,
      )
      .set('Cookie', director);
    expect(crossDelete.status).toBe(404);

    const stillThere = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/notes`)
      .set('Cookie', director);
    expect(stillThere.body.notes).toHaveLength(1);
  });
});
