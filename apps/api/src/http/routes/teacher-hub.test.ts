import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Teacher Hub self-scoped routes', () => {
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
      id: 'director-thub-1',
      email: 'director-thub@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs(
      'director-thub@academia.test',
      'director-password-12',
    ))!;
  }

  it('rejects anonymous callers with 401', async () => {
    expect((await request(fixture.app).get('/teachers/me')).status).toBe(401);
    expect(
      (await request(fixture.app).get('/teachers/me/students')).status,
    ).toBe(401);
    expect(
      (await request(fixture.app).get('/teachers/me/materials')).status,
    ).toBe(401);
    expect(
      (
        await request(fixture.app)
          .get('/teachers/me/attendance')
          .query({ from: '2026-09-01', to: '2026-09-30' })
      ).status,
    ).toBe(401);
  });

  it('GET /teachers/me returns only the authenticated teacher profile', async () => {
    const director = await seedDirector();
    const a = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'thub-a@academia.test',
        password: 'teacher-password-12',
        firstName: 'Ana',
        lastName: 'Alpha',
        level: 'C1',
      });
    expect(a.status).toBe(201);
    const b = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'thub-b@academia.test',
        password: 'teacher-password-12',
        firstName: 'Beto',
        lastName: 'Beta',
        level: 'C1',
      });
    expect(b.status).toBe(201);

    const cookieA = await loginAs('thub-a@academia.test', 'teacher-password-12');
    const me = await request(fixture.app)
      .get('/teachers/me')
      .set('Cookie', cookieA!);
    expect(me.status).toBe(200);
    expect(me.body.teacher.id).toBe(a.body.teacher.id);
    expect(me.body.teacher.id).not.toBe(b.body.teacher.id);

    const asDirector = await request(fixture.app)
      .get('/teachers/me')
      .set('Cookie', director);
    expect(asDirector.status).toBe(403);
  });

  it('students list is ownership-scoped; unrelated student not visible', async () => {
    const director = await seedDirector();
    const teacherA = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'thub-stu-a@academia.test',
        password: 'teacher-password-12',
        firstName: 'Tea',
        lastName: 'A',
        level: 'C1',
      });
    const teacherB = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'thub-stu-b@academia.test',
        password: 'teacher-password-12',
        firstName: 'Tea',
        lastName: 'B',
        level: 'C1',
      });
    expect(teacherA.status).toBe(201);
    expect(teacherB.status).toBe(201);

    const studentMine = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'thub-s-mine@academia.test',
        password: 'student-password-12',
        firstName: 'Mia',
        lastName: 'Mine',
        level: 'A1',
      });
    const studentOther = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'thub-s-other@academia.test',
        password: 'student-password-12',
        firstName: 'Oli',
        lastName: 'Other',
        level: 'A2',
      });
    expect(studentMine.status).toBe(201);
    expect(studentOther.status).toBe(201);

    fixture.relatedStudents.seed(teacherA.body.teacher.id, {
      id: studentMine.body.student.id,
      email: 'thub-s-mine@academia.test',
      firstName: 'Mia',
      lastName: 'Mine',
      level: 'A1',
      isActive: true,
      viaAssignment: true,
      groups: [],
    });
    fixture.relatedStudents.seed(teacherB.body.teacher.id, {
      id: studentOther.body.student.id,
      email: 'thub-s-other@academia.test',
      firstName: 'Oli',
      lastName: 'Other',
      level: 'A2',
      isActive: true,
      viaAssignment: true,
      groups: [],
    });

    const cookieA = await loginAs(
      'thub-stu-a@academia.test',
      'teacher-password-12',
    );
    const list = await request(fixture.app)
      .get('/teachers/me/students')
      .set('Cookie', cookieA!);
    expect(list.status).toBe(200);
    expect(list.body.students).toHaveLength(1);
    expect(list.body.students[0].id).toBe(studentMine.body.student.id);

    // IDOR: teacher cannot read arbitrary student registry
    const idor = await request(fixture.app)
      .get(`/students/${studentOther.body.student.id}`)
      .set('Cookie', cookieA!);
    expect([403, 404]).toContain(idor.status);
  });

  it('materials list is ownership-scoped per teacher', async () => {
    const director = await seedDirector();
    const teacherA = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'thub-mat-a@academia.test',
        password: 'teacher-password-12',
        firstName: 'Mat',
        lastName: 'A',
        level: 'C1',
      });
    const teacherB = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'thub-mat-b@academia.test',
        password: 'teacher-password-12',
        firstName: 'Mat',
        lastName: 'B',
        level: 'C1',
      });
    expect(teacherA.status).toBe(201);
    expect(teacherB.status).toBe(201);

    const courseA = await request(fixture.app)
      .post('/courses')
      .set('Cookie', director)
      .send({
        name: 'Teacher A course',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
      });
    const courseB = await request(fixture.app)
      .post('/courses')
      .set('Cookie', director)
      .send({
        name: 'Teacher B course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(courseA.status).toBe(201);
    expect(courseB.status).toBe(201);
    fixture.materials.seedCourse(courseA.body.course.id);
    fixture.materials.seedCourse(courseB.body.course.id);

    const materialA = await request(fixture.app)
      .post('/materials')
      .set('Cookie', director)
      .send({
        title: 'Material A',
        kind: 'LINK',
        externalUrl: 'https://example.com/a',
        courseId: courseA.body.course.id,
      });
    expect(materialA.status).toBe(201);

    fixture.materials.deps.teacherCourses.set(
      teacherA.body.teacher.id,
      new Set([courseA.body.course.id]),
    );
    fixture.materials.deps.teacherCourses.set(
      teacherB.body.teacher.id,
      new Set([courseB.body.course.id]),
    );

    const cookieA = await loginAs(
      'thub-mat-a@academia.test',
      'teacher-password-12',
    );
    const cookieB = await loginAs(
      'thub-mat-b@academia.test',
      'teacher-password-12',
    );

    const listA = await request(fixture.app)
      .get('/teachers/me/materials')
      .set('Cookie', cookieA!);
    expect(listA.status).toBe(200);
    expect(listA.body.materials).toHaveLength(1);
    expect(listA.body.materials[0].id).toBe(materialA.body.material.id);

    const listB = await request(fixture.app)
      .get('/teachers/me/materials')
      .set('Cookie', cookieB!);
    expect(listB.status).toBe(200);
    expect(listB.body.materials).toHaveLength(0);
  });

  it('attendance history is teacher-scoped; cannot write on foreign class', async () => {
    const director = await seedDirector();
    const teacherA = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'thub-att-a@academia.test',
        password: 'teacher-password-12',
        firstName: 'Att',
        lastName: 'A',
        level: 'C1',
      });
    const teacherB = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'thub-att-b@academia.test',
        password: 'teacher-password-12',
        firstName: 'Att',
        lastName: 'B',
        level: 'C1',
      });
    expect(teacherA.status).toBe(201);
    expect(teacherB.status).toBe(201);

    async function seedSession(teacherId: string, name: string, startAt: string) {
      const course = await request(fixture.app)
        .post('/courses')
        .set('Cookie', director)
        .send({
          name,
          courseType: 'REGULAR',
          serviceType: 'ONE_TO_ONE_60',
        });
      expect(course.status).toBe(201);
      const group = await request(fixture.app)
        .post('/groups')
        .set('Cookie', director)
        .send({ courseId: course.body.course.id, name: `${name}-g` });
      expect(group.status).toBe(201);
      await request(fixture.app)
        .post(`/groups/${group.body.group.id}/teacher`)
        .set('Cookie', director)
        .send({ teacherId });
      const option = await request(fixture.app)
        .post('/schedule-options')
        .set('Cookie', director)
        .send({ day: 'MONDAY', startTime: '10:00', endTime: '11:00' });
      expect(option.status).toBe(201);
      await request(fixture.app)
        .patch(`/groups/${group.body.group.id}`)
        .set('Cookie', director)
        .send({ scheduleOptionId: option.body.scheduleOption.id });
      const student = await request(fixture.app)
        .post('/students')
        .set('Cookie', director)
        .send({
          email: `${name.replace(/\s+/g, '-').toLowerCase()}@academia.test`,
          password: 'student-password-12',
          firstName: 'Stu',
          lastName: name.slice(0, 8),
          level: 'A1',
        });
      expect(student.status).toBe(201);
      await request(fixture.app)
        .post(`/groups/${group.body.group.id}/students`)
        .set('Cookie', director)
        .send({ studentId: student.body.student.id });
      const session = await request(fixture.app)
        .post('/classes')
        .set('Cookie', director)
        .send({ groupId: group.body.group.id, startAt });
      expect(session.status).toBe(201);
      return {
        sessionId: session.body.classSession.id as string,
        studentId: student.body.student.id as string,
      };
    }

    const mine = await seedSession(
      teacherA.body.teacher.id,
      'Thub Att A Course',
      '2026-09-20T15:00:00.000Z',
    );
    const theirs = await seedSession(
      teacherB.body.teacher.id,
      'Thub Att B Course',
      '2026-09-21T15:00:00.000Z',
    );

    const cookieA = await loginAs(
      'thub-att-a@academia.test',
      'teacher-password-12',
    );
    const cookieB = await loginAs(
      'thub-att-b@academia.test',
      'teacher-password-12',
    );

    const markMine = await request(fixture.app)
      .post(`/classes/${mine.sessionId}/attendance`)
      .set('Cookie', cookieA!)
      .send({ studentId: mine.studentId, status: 'PRESENT' });
    expect(markMine.status).toBe(201);

    const markTheirs = await request(fixture.app)
      .post(`/classes/${theirs.sessionId}/attendance`)
      .set('Cookie', cookieB!)
      .send({ studentId: theirs.studentId, status: 'ABSENT' });
    expect(markTheirs.status).toBe(201);

    const history = await request(fixture.app)
      .get('/teachers/me/attendance')
      .query({ from: '2026-09-01', to: '2026-09-30' })
      .set('Cookie', cookieA!);
    expect(history.status).toBe(200);
    expect(history.body.attendances).toHaveLength(1);
    expect(history.body.attendances[0].classSessionId).toBe(mine.sessionId);
    expect(history.body.attendances[0].status).toBe('PRESENT');

    const foreignWrite = await request(fixture.app)
      .post(`/classes/${theirs.sessionId}/attendance`)
      .set('Cookie', cookieA!)
      .send({ studentId: theirs.studentId, status: 'PRESENT' });
    expect([403, 404]).toContain(foreignWrite.status);

    const foreignRead = await request(fixture.app)
      .get(`/classes/${theirs.sessionId}/attendance`)
      .set('Cookie', cookieA!);
    expect([403, 404]).toContain(foreignRead.status);
  });
});
