import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('ClassSession write ownership', () => {
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
      id: 'director-write-1',
      email: 'directora-write@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs(
      'directora-write@academia.test',
      'director-password-12',
    ))!;
  }

  async function createGroupWithTeacher(
    cookie: string,
    opts: {
      courseName: string;
      groupName: string;
      teacherEmail: string;
      teacherPassword: string;
      startAt: string;
    },
  ): Promise<{
    groupId: string;
    teacherId: string;
    teacherCookie: string;
    classSessionId: string;
  }> {
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

    const session = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId: group.body.group.id, startAt: opts.startAt });
    expect(session.status).toBe(201);

    return {
      groupId: group.body.group.id as string,
      teacherId: teacher.body.teacher.id as string,
      teacherCookie: (await loginAs(
        opts.teacherEmail,
        opts.teacherPassword,
      ))!,
      classSessionId: session.body.classSession.id as string,
    };
  }

  it('lets a group teacher create, patch and delete own sessions', async () => {
    const director = await seedDirector();
    const owned = await createGroupWithTeacher(director, {
      courseName: 'Write Course A',
      groupName: 'Write Group A',
      teacherEmail: 'teacher-write-a@academia.test',
      teacherPassword: 'teacher-password-12',
      startAt: '2026-09-21T21:00:00.000Z',
    });

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', owned.teacherCookie)
      .send({
        groupId: owned.groupId,
        startAt: '2026-09-28T21:00:00.000Z',
      });
    expect(created.status).toBe(201);

    const patched = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', owned.teacherCookie)
      .send({ meetingUrl: 'https://meet.example.com/owned' });
    expect(patched.status).toBe(200);
    expect(patched.body.classSession.meetingUrl).toBe(
      'https://meet.example.com/owned',
    );

    const removed = await request(fixture.app)
      .delete(`/classes/${created.body.classSession.id}`)
      .set('Cookie', owned.teacherCookie);
    expect(removed.status).toBe(200);
    expect(removed.body.classSession.isActive).toBe(false);
  });

  it('blocks another teacher, students, and forged teacherId body fields', async () => {
    const director = await seedDirector();
    const groupA = await createGroupWithTeacher(director, {
      courseName: 'Write Course A2',
      groupName: 'Write Group A2',
      teacherEmail: 'teacher-write-a2@academia.test',
      teacherPassword: 'teacher-password-12',
      startAt: '2026-09-21T18:00:00.000Z',
    });
    const groupB = await createGroupWithTeacher(director, {
      courseName: 'Write Course B2',
      groupName: 'Write Group B2',
      teacherEmail: 'teacher-write-b2@academia.test',
      teacherPassword: 'teacher-password-12',
      startAt: '2026-09-21T21:00:00.000Z',
    });

    const foreignCreate = await request(fixture.app)
      .post('/classes')
      .set('Cookie', groupB.teacherCookie)
      .send({
        groupId: groupA.groupId,
        startAt: '2026-10-05T21:00:00.000Z',
        teacherId: groupA.teacherId,
      });
    expect(foreignCreate.status).toBe(403);

    const foreignPatch = await request(fixture.app)
      .patch(`/classes/${groupA.classSessionId}`)
      .set('Cookie', groupB.teacherCookie)
      .send({
        meetingUrl: 'https://meet.example.com/hijack',
        teacherId: groupA.teacherId,
      });
    expect(foreignPatch.status).toBe(403);

    const foreignDelete = await request(fixture.app)
      .delete(`/classes/${groupA.classSessionId}`)
      .set('Cookie', groupB.teacherCookie);
    expect(foreignDelete.status).toBe(403);

    const student = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'student-write@academia.test',
        password: 'student-password-12',
        firstName: 'Stu',
        lastName: 'Dent',
        level: 'B1',
      });
    expect(student.status).toBe(201);
    await request(fixture.app)
      .post(`/groups/${groupA.groupId}/students`)
      .set('Cookie', director)
      .send({ studentId: student.body.student.id });
    const studentCookie = (await loginAs(
      'student-write@academia.test',
      'student-password-12',
    ))!;

    expect(
      (
        await request(fixture.app)
          .post('/classes')
          .set('Cookie', studentCookie)
          .send({
            groupId: groupA.groupId,
            startAt: '2026-10-12T21:00:00.000Z',
          })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(fixture.app)
          .patch(`/classes/${groupA.classSessionId}`)
          .set('Cookie', studentCookie)
          .send({ isActive: false })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(fixture.app)
          .delete(`/classes/${groupA.classSessionId}`)
          .set('Cookie', studentCookie)
      ).status,
    ).toBe(403);
  });

  it('keeps generate gated by classes.create (no teacher ownership bypass)', async () => {
    const director = await seedDirector();
    const owned = await createGroupWithTeacher(director, {
      courseName: 'Write Course Gen',
      groupName: 'Write Group Gen',
      teacherEmail: 'teacher-write-gen@academia.test',
      teacherPassword: 'teacher-password-12',
      startAt: '2026-09-14T21:00:00.000Z',
    });

    const asTeacher = await request(fixture.app)
      .post(`/groups/${owned.groupId}/classes/generate`)
      .set('Cookie', owned.teacherCookie)
      .send({ from: '2026-10-01', to: '2026-10-31' });
    expect(asTeacher.status).toBe(403);

    const asDirector = await request(fixture.app)
      .post(`/groups/${owned.groupId}/classes/generate`)
      .set('Cookie', director)
      .send({ from: '2026-10-01', to: '2026-10-31' });
    expect(asDirector.status).toBe(200);
    expect(asDirector.body.generatedCount).toBeGreaterThanOrEqual(0);
  });
});
