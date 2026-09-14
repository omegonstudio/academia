import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('ClassSession read ownership', () => {
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
      id: 'director-own-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  async function createGroupWithTeacher(
    cookie: string,
    opts: {
      courseName: string;
      groupName: string;
      teacherEmail: string;
      teacherPassword: string;
    },
  ): Promise<{ groupId: string; teacherId: string }> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: opts.courseName,
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({
        courseId: course.body.course.id,
        name: opts.groupName,
      });
    expect(group.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: opts.teacherEmail,
        password: opts.teacherPassword,
        firstName: 'Tea',
        lastName: 'Cher',
        level: 'C1',
      });
    expect(teacher.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: teacher.body.teacher.id });

    const option = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', cookie)
      .send({ day: 'MONDAY', startTime: '18:00', endTime: '20:00' });
    expect(option.status).toBe(201);

    await request(fixture.app)
      .patch(`/groups/${group.body.group.id}`)
      .set('Cookie', cookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });

    return {
      groupId: group.body.group.id as string,
      teacherId: teacher.body.teacher.id as string,
    };
  }

  it('lets a group teacher read own sessions but not another teacher group', async () => {
    const director = await seedDirector();
    const groupA = await createGroupWithTeacher(director, {
      courseName: 'Course A',
      groupName: 'Group A',
      teacherEmail: 'teacher-a@academia.test',
      teacherPassword: 'teacher-password-12',
    });
    const groupB = await createGroupWithTeacher(director, {
      courseName: 'Course B',
      groupName: 'Group B',
      teacherEmail: 'teacher-b@academia.test',
      teacherPassword: 'teacher-password-12',
    });

    const sessionA = await request(fixture.app)
      .post('/classes')
      .set('Cookie', director)
      .send({ groupId: groupA.groupId, startAt: '2026-09-14T21:00:00.000Z' });
    const sessionB = await request(fixture.app)
      .post('/classes')
      .set('Cookie', director)
      .send({ groupId: groupB.groupId, startAt: '2026-09-21T21:00:00.000Z' });
    expect(sessionA.status).toBe(201);
    expect(sessionB.status).toBe(201);

    const teacherCookie = await loginAs(
      'teacher-a@academia.test',
      'teacher-password-12',
    );

    const listed = await request(fixture.app)
      .get('/classes')
      .set('Cookie', teacherCookie!);
    expect(listed.status).toBe(200);
    expect(listed.body.classSessions).toHaveLength(1);
    expect(listed.body.classSessions[0].id).toBe(sessionA.body.classSession.id);

    expect(
      (
        await request(fixture.app)
          .get(`/classes/${sessionA.body.classSession.id}`)
          .set('Cookie', teacherCookie!)
      ).status,
    ).toBe(200);

    expect(
      (
        await request(fixture.app)
          .get(`/classes/${sessionB.body.classSession.id}`)
          .set('Cookie', teacherCookie!)
      ).status,
    ).toBe(403);

    const calendar = await request(fixture.app)
      .get('/classes/calendar?from=2026-09-01&to=2026-09-30')
      .set('Cookie', teacherCookie!);
    expect(calendar.status).toBe(200);
    expect(calendar.body.classSessions).toHaveLength(1);
    expect(calendar.body.classSessions[0].group.id).toBe(groupA.groupId);
  });

  it('lets an enrolled student read group sessions and loses access after unenroll', async () => {
    const director = await seedDirector();
    const group = await createGroupWithTeacher(director, {
      courseName: 'Student Course',
      groupName: 'Student Group',
      teacherEmail: 'teacher-s@academia.test',
      teacherPassword: 'teacher-password-12',
    });

    const student = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'alumno-own@academia.test',
        password: 'student-password-12',
        firstName: 'Alu',
        lastName: 'Mno',
        level: 'B1',
      });
    expect(student.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${group.groupId}/students`)
      .set('Cookie', director)
      .send({ studentId: student.body.student.id });

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', director)
      .send({ groupId: group.groupId, startAt: '2026-09-14T21:00:00.000Z' });
    expect(created.status).toBe(201);

    const studentCookie = await loginAs(
      'alumno-own@academia.test',
      'student-password-12',
    );

    expect(
      (
        await request(fixture.app)
          .get(`/classes/${created.body.classSession.id}`)
          .set('Cookie', studentCookie!)
      ).status,
    ).toBe(200);

    const calendar = await request(fixture.app)
      .get('/classes/calendar?from=2026-09-01&to=2026-09-30')
      .set('Cookie', studentCookie!);
    expect(calendar.status).toBe(200);
    expect(calendar.body.classSessions).toHaveLength(1);

    await request(fixture.app)
      .delete(`/groups/${group.groupId}/students/${student.body.student.id}`)
      .set('Cookie', director);

    expect(
      (
        await request(fixture.app)
          .get(`/classes/${created.body.classSession.id}`)
          .set('Cookie', studentCookie!)
      ).status,
    ).toBe(403);

    const empty = await request(fixture.app)
      .get('/classes/calendar?from=2026-09-01&to=2026-09-30')
      .set('Cookie', studentCookie!);
    expect(empty.status).toBe(200);
    expect(empty.body.classSessions).toEqual([]);
  });

  it('does not grant write access to teachers via ownership', async () => {
    const director = await seedDirector();
    const group = await createGroupWithTeacher(director, {
      courseName: 'Write Course',
      groupName: 'Write Group',
      teacherEmail: 'teacher-w@academia.test',
      teacherPassword: 'teacher-password-12',
    });
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', director)
      .send({ groupId: group.groupId, startAt: '2026-09-14T21:00:00.000Z' });

    const teacherCookie = await loginAs(
      'teacher-w@academia.test',
      'teacher-password-12',
    );

    expect(
      (
        await request(fixture.app)
          .patch(`/classes/${created.body.classSession.id}`)
          .set('Cookie', teacherCookie!)
          .send({ meetingUrl: 'https://meet.google.com/abc-defg-hij' })
      ).status,
    ).toBe(403);
  });
});
