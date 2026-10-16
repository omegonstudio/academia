import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Email templates + Google Meet status', () => {
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

  it('lets DIRECTOR list and update templates', async () => {
    fixture.users.seed({
      id: 'director-email-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    const cookie = (await loginAs(
      'directora@academia.test',
      'director-password-12',
    ))!;

    const listed = await request(fixture.app)
      .get('/email-templates')
      .set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.templates.length).toBeGreaterThanOrEqual(3);
    expect(listed.body.placeholders).toContain('{{meetingUrl}}');

    const patched = await request(fixture.app)
      .patch('/email-templates')
      .set('Cookie', cookie)
      .send({
        type: 'CLASS_MEETING_LINK',
        subject: 'Meet listo',
        body: 'Hola {{displayName}}, link: {{meetingUrl}}',
      });
    expect(patched.status).toBe(200);
    expect(patched.body.template.subject).toBe('Meet listo');
  });

  it('forbids STUDENT from editing templates', async () => {
    fixture.users.seed({
      id: 'student-email-1',
      email: 'alumno@academia.test',
      name: 'Alumno',
      role: 'STUDENT',
      isActive: true,
      passwordHash: await hashPassword('student-password-12'),
    });
    const cookie = (await loginAs(
      'alumno@academia.test',
      'student-password-12',
    ))!;

    expect(
      (await request(fixture.app).get('/email-templates').set('Cookie', cookie))
        .status,
    ).toBe(403);
  });

  it('reports Google Meet as not configured by default', async () => {
    fixture.users.seed({
      id: 'teacher-meet-1',
      email: 'profe@academia.test',
      name: 'Profe',
      role: 'TEACHER',
      isActive: true,
      passwordHash: await hashPassword('teacher-password-12'),
    });
    const cookie = (await loginAs(
      'profe@academia.test',
      'teacher-password-12',
    ))!;

    const status = await request(fixture.app)
      .get('/google-meet/status')
      .set('Cookie', cookie);
    expect(status.status).toBe(200);
    expect(status.body.configured).toBe(false);
  });

  it('reports Zoom as not configured by default', async () => {
    fixture.users.seed({
      id: 'teacher-zoom-status-1',
      email: 'profe-zoom@academia.test',
      name: 'Profe Zoom',
      role: 'TEACHER',
      isActive: true,
      passwordHash: await hashPassword('teacher-password-12'),
    });
    const cookie = (await loginAs(
      'profe-zoom@academia.test',
      'teacher-password-12',
    ))!;

    const status = await request(fixture.app)
      .get('/zoom/status')
      .set('Cookie', cookie);
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ configured: false });
  });
});
