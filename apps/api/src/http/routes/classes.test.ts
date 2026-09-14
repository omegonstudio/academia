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

describe('ClassSession CRUD', () => {
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
      id: 'director-class-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  async function createReadyGroup(
    cookie: string,
    serviceType: 'ONE_TO_ONE_60' | 'ONE_TO_ONE_90' | 'GROUP_120',
  ): Promise<{ groupId: string; teacherId: string; scheduleOptionId: string }> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: `Course ${serviceType}`,
        courseType: 'REGULAR',
        serviceType,
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({
        courseId: course.body.course.id,
        name: `Group ${serviceType}`,
      });
    expect(group.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: `teacher-${serviceType.toLowerCase()}@academia.test`,
        password: 'teacher-password-12',
        firstName: 'Eva',
        lastName: 'Ruiz',
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
      scheduleOptionId: option.body.scheduleOption.id as string,
    };
  }

  it('rejects anonymous callers with 401', async () => {
    expect((await request(fixture.app).get('/classes')).status).toBe(401);
  });

  it('returns 403 without classes permissions', async () => {
    fixture.users.seed({
      id: 'student-class-1',
      email: 'alumno@academia.test',
      name: 'STUDENT',
      role: 'STUDENT',
      isActive: true,
      passwordHash: await hashPassword('student-password-12'),
    });
    const cookie = await loginAs('alumno@academia.test', 'student-password-12');
    expect(
      (await request(fixture.app).get('/classes').set('Cookie', cookie!)).status,
    ).toBe(403);
  });

  it('creates sessions with duration derived from serviceType', async () => {
    const cookie = await seedDirector();
    const startAt = '2026-09-21T18:00:00.000Z';

    for (const [serviceType, endAt, duration] of [
      ['ONE_TO_ONE_60', '2026-09-21T19:00:00.000Z', 60],
      ['ONE_TO_ONE_90', '2026-09-21T19:30:00.000Z', 90],
      ['GROUP_120', '2026-09-21T20:00:00.000Z', 120],
    ] as const) {
      const { groupId, teacherId, scheduleOptionId } = await createReadyGroup(
        cookie,
        serviceType,
      );
      const created = await request(fixture.app)
        .post('/classes')
        .set('Cookie', cookie)
        .send({ groupId, startAt, durationMinutes: 999 });
      expect(created.status).toBe(201);
      expect(created.body.classSession).toMatchObject({
        groupId,
        startAt,
        endAt,
        serviceType,
        durationMinutes: duration,
        teacherId,
        scheduleOptionId,
        meetingUrl: null,
        isActive: true,
      });
    }
  });

  it('rejects missing group, inactive group and group without schedule', async () => {
    const cookie = await seedDirector();

    expect(
      (
        await request(fixture.app)
          .post('/classes')
          .set('Cookie', cookie)
          .send({
            groupId: randomUUID(),
            startAt: '2026-09-21T18:00:00.000Z',
          })
      ).status,
    ).toBe(404);

    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'No schedule',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: course.body.course.id, name: 'Bare' });

    const noSchedule = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId: group.body.group.id,
        startAt: '2026-09-21T18:00:00.000Z',
      });
    expect(noSchedule.status).toBe(400);
    expect(noSchedule.body.error.message).toMatch(/schedule option/);

    const ready = await createReadyGroup(cookie, 'GROUP_120');
    await request(fixture.app)
      .delete(`/groups/${ready.groupId}`)
      .set('Cookie', cookie);

    const inactive = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId: ready.groupId,
        startAt: '2026-09-21T18:00:00.000Z',
      });
    expect(inactive.status).toBe(400);
  });

  it('lists, reads, updates and soft-deletes', async () => {
    const cookie = await seedDirector();
    const { groupId } = await createReadyGroup(cookie, 'GROUP_120');

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt: '2026-09-21T18:00:00.000Z' });
    expect(created.status).toBe(201);
    const id = created.body.classSession.id as string;

    const listed = await request(fixture.app)
      .get(`/classes?groupId=${groupId}`)
      .set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.classSessions).toHaveLength(1);

    const got = await request(fixture.app)
      .get(`/classes/${id}`)
      .set('Cookie', cookie);
    expect(got.status).toBe(200);

    const patched = await request(fixture.app)
      .patch(`/classes/${id}`)
      .set('Cookie', cookie)
      .send({ startAt: '2026-09-28T18:00:00.000Z' });
    expect(patched.status).toBe(200);
    expect(patched.body.classSession.endAt).toBe('2026-09-28T20:00:00.000Z');

    const removed = await request(fixture.app)
      .delete(`/classes/${id}`)
      .set('Cookie', cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.classSession.isActive).toBe(false);

    expect(
      (
        await request(fixture.app)
          .get(`/classes/${randomUUID()}`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(404);
  });

  it('blocks TEACHER without classes grants from mutating by id', async () => {
    const directorCookie = await seedDirector();
    const { groupId } = await createReadyGroup(directorCookie, 'GROUP_120');
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', directorCookie)
      .send({ groupId, startAt: '2026-09-21T18:00:00.000Z' });

    fixture.users.seed({
      id: 'teacher-class-1',
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
          .get(`/classes/${created.body.classSession.id}`)
          .set('Cookie', teacherCookie!)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(fixture.app)
          .patch(`/classes/${created.body.classSession.id}`)
          .set('Cookie', teacherCookie!)
          .send({ startAt: '2026-09-28T18:00:00.000Z' })
      ).status,
    ).toBe(403);
  });

  it('rejects overlapping sessions for the same teacher with 409', async () => {
    const cookie = await seedDirector();
    const first = await createReadyGroup(cookie, 'ONE_TO_ONE_60');

    const courseB = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Second course',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
      });
    const groupB = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({
        courseId: courseB.body.course.id,
        name: 'Second group',
      });
    await request(fixture.app)
      .post(`/groups/${groupB.body.group.id}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: first.teacherId });
    await request(fixture.app)
      .patch(`/groups/${groupB.body.group.id}`)
      .set('Cookie', cookie)
      .send({ scheduleOptionId: first.scheduleOptionId });

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId: first.groupId,
        startAt: '2026-09-21T10:00:00.000Z',
      });
    expect(created.status).toBe(201);

    const conflict = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId: groupB.body.group.id,
        startAt: '2026-09-21T10:30:00.000Z',
      });
    expect(conflict.status).toBe(409);

    const adjacent = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId: groupB.body.group.id,
        startAt: '2026-09-21T11:00:00.000Z',
      });
    expect(adjacent.status).toBe(201);
  });

  it('accepts https meetingUrl on create/patch and rejects unsafe schemes', async () => {
    const cookie = await seedDirector();
    const { groupId } = await createReadyGroup(cookie, 'GROUP_120');

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: '2026-09-21T18:00:00.000Z',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      });
    expect(created.status).toBe(201);
    expect(created.body.classSession.meetingUrl).toBe(
      'https://meet.google.com/abc-defg-hij',
    );

    const cleared = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ meetingUrl: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.classSession.meetingUrl).toBeNull();
    expect(cleared.body.classSession.startAt).toBe(
      '2026-09-21T18:00:00.000Z',
    );

    const replaced = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ meetingUrl: 'https://zoom.us/j/987654321' });
    expect(replaced.status).toBe(200);
    expect(replaced.body.classSession.meetingUrl).toBe(
      'https://zoom.us/j/987654321',
    );

    const got = await request(fixture.app)
      .get(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie);
    expect(got.body.classSession.meetingUrl).toBe(
      'https://zoom.us/j/987654321',
    );

    expect(
      (
        await request(fixture.app)
          .post('/classes')
          .set('Cookie', cookie)
          .send({
            groupId,
            startAt: '2026-09-28T18:00:00.000Z',
            meetingUrl: 'javascript:alert(1)',
          })
      ).status,
    ).toBe(400);

    expect(
      (
        await request(fixture.app)
          .post('/classes')
          .set('Cookie', cookie)
          .send({
            groupId,
            startAt: '2026-10-05T18:00:00.000Z',
            meetingUrl: 'http://meet.google.com/x',
          })
      ).status,
    ).toBe(400);
  });
});
