import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Courses CRUD', () => {
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

  async function seedRole(
    role: 'DIRECTOR' | 'TEACHER' | 'STUDENT',
    email: string,
    password: string,
  ): Promise<void> {
    fixture.users.seed({
      id: `${role.toLowerCase()}-course-1`,
      email,
      name: role,
      role,
      isActive: true,
      passwordHash: await hashPassword(password),
    });
  }

  it('rejects anonymous callers with 401', async () => {
    expect((await request(fixture.app).get('/courses')).status).toBe(401);
    expect(
      (
        await request(fixture.app)
          .post('/courses')
          .send({
            name: 'X',
            courseType: 'REGULAR',
            serviceType: 'ONE_TO_ONE_60',
          })
      ).status,
    ).toBe(401);
  });

  it('returns 403 when TEACHER lacks courses permissions', async () => {
    await seedRole('TEACHER', 'docente@academia.test', 'teacher-password-12');
    const cookie = await loginAs('docente@academia.test', 'teacher-password-12');

    expect(
      (await request(fixture.app).get('/courses').set('Cookie', cookie!)).status,
    ).toBe(403);
  });

  it('lets DIRECTOR create, list, read, update and soft-delete', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const created = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie!)
      .send({
        name: 'Español 1:1',
        description: 'Clases individuales',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
      });
    expect(created.status).toBe(201);
    expect(created.body.course).toMatchObject({
      name: 'Español 1:1',
      description: 'Clases individuales',
      courseType: 'REGULAR',
      serviceType: 'ONE_TO_ONE_60',
      durationMinutes: 60,
      isActive: true,
    });

    const listed = await request(fixture.app)
      .get('/courses')
      .set('Cookie', cookie!);
    expect(listed.status).toBe(200);
    expect(listed.body.courses).toHaveLength(1);

    const id = created.body.course.id as string;
    const got = await request(fixture.app)
      .get(`/courses/${id}`)
      .set('Cookie', cookie!);
    expect(got.status).toBe(200);

    const patched = await request(fixture.app)
      .patch(`/courses/${id}`)
      .set('Cookie', cookie!)
      .send({ name: 'Español intensivo' });
    expect(patched.status).toBe(200);
    expect(patched.body.course.name).toBe('Español intensivo');
    expect(patched.body.course.courseType).toBe('REGULAR');
    expect(patched.body.course.serviceType).toBe('ONE_TO_ONE_60');
    expect(patched.body.course.durationMinutes).toBe(60);

    const removed = await request(fixture.app)
      .delete(`/courses/${id}`)
      .set('Cookie', cookie!);
    expect(removed.status).toBe(200);
    expect(removed.body.course.isActive).toBe(false);
  });

  it('rejects invalid create payloads with 400', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const response = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie!)
      .send({ name: '' });
    expect(response.status).toBe(400);
  });
});

describe('Course serviceType configuration', () => {
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
      id: 'director-svc-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  it('accepts ONE_TO_ONE_60, ONE_TO_ONE_90 and GROUP_120 with derived duration', async () => {
    const cookie = await seedDirector();

    const sixty = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: '1:1 60',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
      });
    expect(sixty.status).toBe(201);
    expect(sixty.body.course.durationMinutes).toBe(60);

    const ninety = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: '1:1 90',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_90',
      });
    expect(ninety.status).toBe(201);
    expect(ninety.body.course.durationMinutes).toBe(90);

    const group = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Grupo 120',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(group.status).toBe(201);
    expect(group.body.course.durationMinutes).toBe(120);

    const patched = await request(fixture.app)
      .patch(`/courses/${sixty.body.course.id}`)
      .set('Cookie', cookie)
      .send({ serviceType: 'ONE_TO_ONE_90' });
    expect(patched.status).toBe(200);
    expect(patched.body.course).toMatchObject({
      serviceType: 'ONE_TO_ONE_90',
      durationMinutes: 90,
    });
  });

  it('rejects invalid service types and free-form durations', async () => {
    const cookie = await seedDirector();

    for (const serviceType of [
      'ONE_TO_ONE_30',
      'ONE_TO_ONE_45',
      'ONE_TO_ONE_75',
      'ONE_TO_ONE_120',
      'GROUP_60',
      'GROUP_90',
      60,
      90,
      120,
      'INVALID',
    ]) {
      const response = await request(fixture.app)
        .post('/courses')
        .set('Cookie', cookie)
        .send({ name: 'Bad', courseType: 'REGULAR', serviceType });
      expect(response.status).toBe(400);
    }

    expect(
      (
        await request(fixture.app)
          .post('/courses')
          .set('Cookie', cookie)
          .send({ name: 'Missing type', courseType: 'REGULAR' })
      ).status,
    ).toBe(400);

    const ignoredMinutes = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Free minutes ignored',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
        durationMinutes: 75,
      });
    expect(ignoredMinutes.status).toBe(201);
    expect(ignoredMinutes.body.course.durationMinutes).toBe(60);
  });

  it('rejects TEACHER mutating serviceType without permission', async () => {
    const directorCookie = await seedDirector();
    const created = await request(fixture.app)
      .post('/courses')
      .set('Cookie', directorCookie)
      .send({
        name: 'Locked',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(created.status).toBe(201);

    fixture.users.seed({
      id: 'teacher-svc-1',
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
          .patch(`/courses/${created.body.course.id}`)
          .set('Cookie', teacherCookie!)
          .send({ serviceType: 'ONE_TO_ONE_60' })
      ).status,
    ).toBe(403);
  });
});

describe('Course courseType (teacher-training)', () => {
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
      id: 'director-ct-1',
      email: 'directora@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs('directora@academia.test', 'director-password-12'))!;
  }

  it('accepts REGULAR and TEACHER_TRAINING without changing duration rules', async () => {
    const cookie = await seedDirector();

    const regular = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Regular group',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(regular.status).toBe(201);
    expect(regular.body.course).toMatchObject({
      courseType: 'REGULAR',
      serviceType: 'GROUP_120',
      durationMinutes: 120,
    });

    const training = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Formación docentes',
        courseType: 'TEACHER_TRAINING',
        serviceType: 'GROUP_120',
      });
    expect(training.status).toBe(201);
    expect(training.body.course).toMatchObject({
      courseType: 'TEACHER_TRAINING',
      serviceType: 'GROUP_120',
      durationMinutes: 120,
    });

    const oneToOneTraining = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Mentor 1:1',
        courseType: 'TEACHER_TRAINING',
        serviceType: 'ONE_TO_ONE_60',
      });
    expect(oneToOneTraining.status).toBe(201);
    expect(oneToOneTraining.body.course).toMatchObject({
      courseType: 'TEACHER_TRAINING',
      serviceType: 'ONE_TO_ONE_60',
      durationMinutes: 60,
    });

    const patched = await request(fixture.app)
      .patch(`/courses/${regular.body.course.id}`)
      .set('Cookie', cookie)
      .send({ courseType: 'TEACHER_TRAINING' });
    expect(patched.status).toBe(200);
    expect(patched.body.course).toMatchObject({
      courseType: 'TEACHER_TRAINING',
      serviceType: 'GROUP_120',
      durationMinutes: 120,
    });
  });

  it('rejects unknown courseType values', async () => {
    const cookie = await seedDirector();

    for (const courseType of ['UNKNOWN', 'TRAINING', 'teacher_training', 1]) {
      const response = await request(fixture.app)
        .post('/courses')
        .set('Cookie', cookie)
        .send({
          name: 'Bad type',
          courseType,
          serviceType: 'GROUP_120',
        });
      expect(response.status).toBe(400);
    }

    expect(
      (
        await request(fixture.app)
          .post('/courses')
          .set('Cookie', cookie)
          .send({ name: 'Missing courseType', serviceType: 'GROUP_120' })
      ).status,
    ).toBe(400);
  });

  it('lets a TEACHER_TRAINING course use Group + Teacher + Schedule + Enrollment', async () => {
    const cookie = await seedDirector();

    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Formación cohort',
        courseType: 'TEACHER_TRAINING',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: course.body.course.id, name: 'Cohorte A' });
    expect(group.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: 'trainer@academia.test',
        password: 'teacher-password-12',
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'C1',
      });
    expect(teacher.status).toBe(201);

    const assignTeacher = await request(fixture.app)
      .post(`/groups/${group.body.group.id}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: teacher.body.teacher.id });
    expect(assignTeacher.status).toBe(200);

    const option = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', cookie)
      .send({ day: 'MONDAY', startTime: '18:00', endTime: '20:00' });
    expect(option.status).toBe(201);

    const schedule = await request(fixture.app)
      .patch(`/groups/${group.body.group.id}`)
      .set('Cookie', cookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });
    expect(schedule.status).toBe(200);
    expect(schedule.body.group.scheduleOptionId).toBe(
      option.body.scheduleOption.id,
    );

    const student = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie)
      .send({
        email: 'trainee@academia.test',
        password: 'student-password-12',
        firstName: 'Ana',
        lastName: 'Pérez',
        level: 'B2',
      });
    expect(student.status).toBe(201);

    const enroll = await request(fixture.app)
      .post(`/groups/${group.body.group.id}/students`)
      .set('Cookie', cookie)
      .send({ studentId: student.body.student.id });
    expect(enroll.status).toBe(201);

    const members = await request(fixture.app)
      .get(`/groups/${group.body.group.id}/students`)
      .set('Cookie', cookie);
    expect(members.status).toBe(200);
    expect(members.body.enrollments).toHaveLength(1);
  });

  it('rejects TEACHER mutating courseType without permission', async () => {
    const directorCookie = await seedDirector();
    const created = await request(fixture.app)
      .post('/courses')
      .set('Cookie', directorCookie)
      .send({
        name: 'Locked type',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });

    fixture.users.seed({
      id: 'teacher-ct-1',
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
          .patch(`/courses/${created.body.course.id}`)
          .set('Cookie', teacherCookie!)
          .send({ courseType: 'TEACHER_TRAINING' })
      ).status,
    ).toBe(403);
  });
});
