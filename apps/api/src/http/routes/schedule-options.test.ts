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

describe('Schedule options CRUD', () => {
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
      id: 'director-sched-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  it('rejects anonymous callers with 401', async () => {
    expect((await request(fixture.app).get('/schedule-options')).status).toBe(
      401,
    );
  });

  it('returns 403 without schedules permissions', async () => {
    fixture.users.seed({
      id: 'teacher-sched-1',
      email: 'docente@academia.test',
      name: 'TEACHER',
      role: 'TEACHER',
      isActive: true,
      passwordHash: await hashPassword('teacher-password-12'),
    });
    const cookie = await loginAs('docente@academia.test', 'teacher-password-12');
    expect(
      (
        await request(fixture.app)
          .get('/schedule-options')
          .set('Cookie', cookie!)
      ).status,
    ).toBe(403);
  });

  it('lets DIRECTOR create, list, read, update and soft-delete', async () => {
    const cookie = await seedDirector();

    const created = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', cookie)
      .send({ day: 'MONDAY', startTime: '18:00', endTime: '20:00' });
    expect(created.status).toBe(201);
    expect(created.body.scheduleOption).toMatchObject({
      day: 'MONDAY',
      startTime: '18:00',
      endTime: '20:00',
      label: 'Lunes 18:00–20:00',
      isActive: true,
    });

    const listed = await request(fixture.app)
      .get('/schedule-options')
      .set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.scheduleOptions).toHaveLength(1);

    const id = created.body.scheduleOption.id as string;
    const got = await request(fixture.app)
      .get(`/schedule-options/${id}`)
      .set('Cookie', cookie);
    expect(got.status).toBe(200);

    const patched = await request(fixture.app)
      .patch(`/schedule-options/${id}`)
      .set('Cookie', cookie)
      .send({ startTime: '17:00' });
    expect(patched.status).toBe(200);
    expect(patched.body.scheduleOption.label).toBe('Lunes 17:00–20:00');

    const removed = await request(fixture.app)
      .delete(`/schedule-options/${id}`)
      .set('Cookie', cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.scheduleOption.isActive).toBe(false);
  });

  it('rejects invalid day, time and start>=end', async () => {
    const cookie = await seedDirector();

    expect(
      (
        await request(fixture.app)
          .post('/schedule-options')
          .set('Cookie', cookie)
          .send({ day: 'LUNES', startTime: '18:00', endTime: '20:00' })
      ).status,
    ).toBe(400);

    expect(
      (
        await request(fixture.app)
          .post('/schedule-options')
          .set('Cookie', cookie)
          .send({ day: 'MONDAY', startTime: '25:00', endTime: '20:00' })
      ).status,
    ).toBe(400);

    expect(
      (
        await request(fixture.app)
          .post('/schedule-options')
          .set('Cookie', cookie)
          .send({ day: 'MONDAY', startTime: '20:00', endTime: '18:00' })
      ).status,
    ).toBe(400);
  });
});

describe('Group → ScheduleOption', () => {
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
      id: 'director-gs-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  it('assigns a schedule option to a group via PATCH', async () => {
    const cookie = await seedDirector();
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({ name: 'Curso', courseType: 'REGULAR', serviceType: 'GROUP_120' });
    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: course.body.course.id, name: 'G1' });
    const option = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', cookie)
      .send({ day: 'TUESDAY', startTime: '10:00', endTime: '12:00' });

    const patched = await request(fixture.app)
      .patch(`/groups/${group.body.group.id}`)
      .set('Cookie', cookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });
    expect(patched.status).toBe(200);
    expect(patched.body.group.scheduleOptionId).toBe(
      option.body.scheduleOption.id,
    );

    expect(
      (
        await request(fixture.app)
          .patch(`/groups/${group.body.group.id}`)
          .set('Cookie', cookie)
          .send({ scheduleOptionId: randomUUID() })
      ).status,
    ).toBe(404);

    await request(fixture.app)
      .delete(`/schedule-options/${option.body.scheduleOption.id}`)
      .set('Cookie', cookie);

    const group2 = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: course.body.course.id, name: 'G2' });
    expect(
      (
        await request(fixture.app)
          .patch(`/groups/${group2.body.group.id}`)
          .set('Cookie', cookie)
          .send({ scheduleOptionId: option.body.scheduleOption.id })
      ).status,
    ).toBe(400);
  });
});
