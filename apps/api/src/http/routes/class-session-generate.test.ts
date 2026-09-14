import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('POST /groups/:id/classes/generate', () => {
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
      id: 'director-gen-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  async function createReadyGroup(cookie: string): Promise<string> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Generate Course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({
        courseId: course.body.course.id,
        name: 'Generate Group',
      });
    expect(group.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: 'teacher-generate@academia.test',
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

    return group.body.group.id as string;
  }

  it('rejects anonymous callers with 401', async () => {
    expect(
      (
        await request(fixture.app)
          .post('/groups/00000000-0000-4000-8000-000000000001/classes/generate')
          .send({ from: '2026-09-14', to: '2026-09-21' })
      ).status,
    ).toBe(401);
  });

  it('generates Monday sessions and is idempotent', async () => {
    const cookie = await seedDirector();
    const groupId = await createReadyGroup(cookie);

    const first = await request(fixture.app)
      .post(`/groups/${groupId}/classes/generate`)
      .set('Cookie', cookie)
      .send({ from: '2026-09-14', to: '2026-10-11' });

    expect(first.status).toBe(200);
    expect(first.body.generatedCount).toBe(4);
    expect(first.body.skippedCount).toBe(0);
    expect(first.body.conflictCount).toBe(0);
    expect(first.body.classSessions[0].startAt).toBe(
      '2026-09-14T21:00:00.000Z',
    );
    expect(first.body.classSessions[0].endAt).toBe('2026-09-14T23:00:00.000Z');
    expect(first.body.classSessions[0].durationMinutes).toBe(120);
    expect(first.body.classSessions[0].meetingUrl).toBeNull();

    const second = await request(fixture.app)
      .post(`/groups/${groupId}/classes/generate`)
      .set('Cookie', cookie)
      .send({ from: '2026-09-14', to: '2026-10-11' });

    expect(second.status).toBe(200);
    expect(second.body.generatedCount).toBe(0);
    expect(second.body.skippedCount).toBe(4);
    expect(second.body.conflictCount).toBe(0);

    const listed = await request(fixture.app)
      .get(`/classes?groupId=${groupId}`)
      .set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.classSessions).toHaveLength(4);
  });

  it('rejects invalid range and client-controlled fields are ignored via schema', async () => {
    const cookie = await seedDirector();
    const groupId = await createReadyGroup(cookie);

    expect(
      (
        await request(fixture.app)
          .post(`/groups/${groupId}/classes/generate`)
          .set('Cookie', cookie)
          .send({ from: '2026-10-11', to: '2026-09-14' })
      ).status,
    ).toBe(400);

    expect(
      (
        await request(fixture.app)
          .post(`/groups/${groupId}/classes/generate`)
          .set('Cookie', cookie)
          .send({ from: '14-09-2026', to: '2026-09-21' })
      ).status,
    ).toBe(400);

    const withExtras = await request(fixture.app)
      .post(`/groups/${groupId}/classes/generate`)
      .set('Cookie', cookie)
      .send({
        from: '2026-09-21',
        to: '2026-09-21',
        durationMinutes: 30,
        startAt: '2026-09-21T00:00:00.000Z',
        timezone: 'UTC',
      });
    expect(withExtras.status).toBe(200);
    expect(withExtras.body.classSessions[0].startAt).toBe(
      '2026-09-21T21:00:00.000Z',
    );
    expect(withExtras.body.classSessions[0].durationMinutes).toBe(120);
  });
});
