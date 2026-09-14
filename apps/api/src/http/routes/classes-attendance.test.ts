import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('ClassSession attendance', () => {
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
      id: 'director-att-1',
      email: 'directora-att@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs(
      'directora-att@academia.test',
      'director-password-12',
    ))!;
  }

  async function seedReadyClass(cookie: string): Promise<{
    groupId: string;
    classSessionId: string;
    teacherId: string;
    teacherCookie: string;
    studentAId: string;
    studentACookie: string;
    studentBId: string;
    studentBCookie: string;
  }> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Attendance Course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({
        courseId: course.body.course.id,
        name: 'Attendance Group',
      });
    expect(group.status).toBe(201);
    const groupId = group.body.group.id as string;

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: 'teacher-att@academia.test',
        password: 'teacher-password-12',
        firstName: 'Tea',
        lastName: 'Cher',
        level: 'C1',
      });
    expect(teacher.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${groupId}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: teacher.body.teacher.id });

    const option = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', cookie)
      .send({ day: 'MONDAY', startTime: '18:00', endTime: '20:00' });
    expect(option.status).toBe(201);

    await request(fixture.app)
      .patch(`/groups/${groupId}`)
      .set('Cookie', cookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });

    const session = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: '2026-09-14T21:00:00.000Z',
      });
    expect(session.status).toBe(201);

    const studentA = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie)
      .send({
        email: 'student-a-att@academia.test',
        password: 'student-password-12',
        firstName: 'Ana',
        lastName: 'Alvarez',
        level: 'B1',
      });
    expect(studentA.status).toBe(201);

    const studentB = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie)
      .send({
        email: 'student-b-att@academia.test',
        password: 'student-password-12',
        firstName: 'Bruno',
        lastName: 'Benitez',
        level: 'B1',
      });
    expect(studentB.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${groupId}/students`)
      .set('Cookie', cookie)
      .send({ studentId: studentA.body.student.id });
    await request(fixture.app)
      .post(`/groups/${groupId}/students`)
      .set('Cookie', cookie)
      .send({ studentId: studentB.body.student.id });

    return {
      groupId,
      classSessionId: session.body.classSession.id as string,
      teacherId: teacher.body.teacher.id as string,
      teacherCookie: (await loginAs(
        'teacher-att@academia.test',
        'teacher-password-12',
      ))!,
      studentAId: studentA.body.student.id as string,
      studentACookie: (await loginAs(
        'student-a-att@academia.test',
        'student-password-12',
      ))!,
      studentBId: studentB.body.student.id as string,
      studentBCookie: (await loginAs(
        'student-b-att@academia.test',
        'student-password-12',
      ))!,
    };
  }

  it('lets director and group teacher manage attendance for enrolled students', async () => {
    const director = await seedDirector();
    const ready = await seedReadyClass(director);

    const created = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', director)
      .send({ studentId: ready.studentAId, status: 'PRESENT' });
    expect(created.status).toBe(201);
    expect(created.body.attendance.status).toBe('PRESENT');

    const dup = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', director)
      .send({ studentId: ready.studentAId, status: 'ABSENT' });
    expect(dup.status).toBe(409);

    const patched = await request(fixture.app)
      .patch(
        `/classes/${ready.classSessionId}/attendance/${ready.studentAId}`,
      )
      .set('Cookie', director)
      .send({ status: 'ABSENT' });
    expect(patched.status).toBe(200);
    expect(patched.body.attendance.status).toBe('ABSENT');

    const byTeacher = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', ready.teacherCookie)
      .send({ studentId: ready.studentBId, status: 'PRESENT' });
    expect(byTeacher.status).toBe(201);

    const list = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', director);
    expect(list.status).toBe(200);
    expect(list.body.attendances).toHaveLength(2);
    expect(list.body.attendances[0].student.lastName).toBe('Alvarez');
  });

  it('rejects non-enrolled students, inactive sessions, and foreign teachers', async () => {
    const director = await seedDirector();
    const ready = await seedReadyClass(director);

    const outsider = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'outsider-att@academia.test',
        password: 'student-password-12',
        firstName: 'Out',
        lastName: 'Sider',
        level: 'A1',
      });
    expect(outsider.status).toBe(201);

    const notEnrolled = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', director)
      .send({ studentId: outsider.body.student.id, status: 'PRESENT' });
    expect(notEnrolled.status).toBe(400);

    await request(fixture.app)
      .patch(`/classes/${ready.classSessionId}`)
      .set('Cookie', director)
      .send({ isActive: false });

    const inactive = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', director)
      .send({ studentId: ready.studentAId, status: 'PRESENT' });
    expect(inactive.status).toBe(400);

    // Reactivate for teacher ownership check on a second class
    await request(fixture.app)
      .patch(`/classes/${ready.classSessionId}`)
      .set('Cookie', director)
      .send({ isActive: true });

    const otherTeacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'teacher-other-att@academia.test',
        password: 'teacher-password-12',
        firstName: 'Other',
        lastName: 'Teacher',
        level: 'C1',
      });
    expect(otherTeacher.status).toBe(201);
    const otherCookie = (await loginAs(
      'teacher-other-att@academia.test',
      'teacher-password-12',
    ))!;

    const foreign = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', otherCookie)
      .send({ studentId: ready.studentAId, status: 'PRESENT' });
    expect(foreign.status).toBe(403);
  });

  it('lets students read only their own attendance and never write', async () => {
    const director = await seedDirector();
    const ready = await seedReadyClass(director);

    await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', director)
      .send({ studentId: ready.studentAId, status: 'PRESENT' });
    await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', director)
      .send({ studentId: ready.studentBId, status: 'ABSENT' });

    const self = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', ready.studentACookie);
    expect(self.status).toBe(200);
    expect(self.body.attendances).toHaveLength(1);
    expect(self.body.attendances[0].studentId).toBe(ready.studentAId);

    const write = await request(fixture.app)
      .post(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', ready.studentACookie)
      .send({ studentId: ready.studentAId, status: 'ABSENT' });
    expect(write.status).toBe(403);

    const patchSelf = await request(fixture.app)
      .patch(
        `/classes/${ready.classSessionId}/attendance/${ready.studentAId}`,
      )
      .set('Cookie', ready.studentACookie)
      .send({ status: 'ABSENT' });
    expect(patchSelf.status).toBe(403);

    await request(fixture.app)
      .delete(`/groups/${ready.groupId}/students/${ready.studentAId}`)
      .set('Cookie', director);

    const afterUnenroll = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', ready.studentACookie);
    expect(afterUnenroll.status).toBe(403);

    const updateAfterUnenroll = await request(fixture.app)
      .patch(
        `/classes/${ready.classSessionId}/attendance/${ready.studentAId}`,
      )
      .set('Cookie', director)
      .send({ status: 'ABSENT' });
    expect(updateAfterUnenroll.status).toBe(400);

    const history = await request(fixture.app)
      .get(`/classes/${ready.classSessionId}/attendance`)
      .set('Cookie', director);
    expect(history.status).toBe(200);
    expect(
      history.body.attendances.some(
        (row: { studentId: string }) => row.studentId === ready.studentAId,
      ),
    ).toBe(true);
  });
});
