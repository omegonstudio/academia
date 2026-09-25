import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('GET /classes/calendar', () => {
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
      id: 'director-cal-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  async function createReadyGroup(cookie: string): Promise<{
    groupId: string;
    teacherId: string;
  }> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Calendar Course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({
        courseId: course.body.course.id,
        name: 'Calendar Group',
      });
    expect(group.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: 'teacher-calendar@academia.test',
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
    };
  }

  it('rejects anonymous and unauthorized callers', async () => {
    expect(
      (
        await request(fixture.app).get(
          '/classes/calendar?from=2026-09-01&to=2026-09-30',
        )
      ).status,
    ).toBe(401);

    fixture.users.seed({
      id: 'student-cal-1',
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
          .get('/classes/calendar?from=2026-09-01&to=2026-09-30')
          .set('Cookie', cookie!)
      ).status,
    ).toBe(403);
  });

  it('returns nested group/course/teacher for sessions in range', async () => {
    const cookie = await seedDirector();
    const { groupId, teacherId } = await createReadyGroup(cookie);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt: '2026-09-14T21:00:00.000Z' });
    expect(created.status).toBe(201);

    await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt: '2026-10-05T21:00:00.000Z' });

    const response = await request(fixture.app)
      .get('/classes/calendar?from=2026-09-01&to=2026-09-30')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.classSessions).toHaveLength(1);
    expect(response.body.classSessions[0]).toMatchObject({
      id: created.body.classSession.id,
      startAt: '2026-09-14T21:00:00.000Z',
      endAt: '2026-09-14T23:00:00.000Z',
      durationMinutes: 120,
      meetingUrl: null,
      group: {
        id: groupId,
        name: 'Calendar Group',
        course: {
          name: 'Calendar Course',
          serviceType: 'GROUP_120',
          courseType: 'REGULAR',
        },
      },
      teacher: {
        id: teacherId,
        firstName: 'Eva',
        lastName: 'Ruiz',
      },
    });
  });

  it('rejects invalid and oversized ranges with 400', async () => {
    const cookie = await seedDirector();

    expect(
      (
        await request(fixture.app)
          .get('/classes/calendar?from=2026-09-30&to=2026-09-01')
          .set('Cookie', cookie)
      ).status,
    ).toBe(400);

    expect(
      (
        await request(fixture.app)
          .get('/classes/calendar?from=not-a-date&to=2026-09-30')
          .set('Cookie', cookie)
      ).status,
    ).toBe(400);

    expect(
      (
        await request(fixture.app)
          .get('/classes/calendar?from=2026-01-01&to=2026-05-01')
          .set('Cookie', cookie)
      ).status,
    ).toBe(400);
  });

  it('returns an empty list when no sessions match', async () => {
    const cookie = await seedDirector();
    const response = await request(fixture.app)
      .get('/classes/calendar?from=2026-09-01&to=2026-09-30')
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.classSessions).toEqual([]);
  });
});
