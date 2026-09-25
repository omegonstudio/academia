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

describe('Student → Teacher assignment', () => {
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
    role: 'SUPER_ADMIN' | 'DIRECTOR' | 'ADMINISTRATIVE' | 'TEACHER' | 'STUDENT',
    email: string,
    password: string,
    id = `${role.toLowerCase()}-1`,
  ): Promise<void> {
    fixture.users.seed({
      id,
      email,
      name: role,
      role,
      isActive: true,
      passwordHash: await hashPassword(password),
    });
  }

  async function createStudent(
    cookie: string,
    email: string,
  ): Promise<{ id: string; userId: string }> {
    const response = await request(fixture.app)
      .post('/students')
      .set('Cookie', cookie)
      .send({
        email,
        password: 'student-password-12',
        firstName: 'Ana',
        lastName: 'Pérez',
        level: 'A1',
      });
    expect(response.status).toBe(201);
    return {
      id: response.body.student.id as string,
      userId: response.body.student.userId as string,
    };
  }

  async function createTeacher(
    cookie: string,
    email: string,
  ): Promise<{ id: string; userId: string }> {
    const response = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email,
        password: 'teacher-password-12',
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'C1',
      });
    expect(response.status).toBe(201);
    return {
      id: response.body.teacher.id as string,
      userId: response.body.teacher.userId as string,
    };
  }

  it('rejects anonymous callers with 401', async () => {
    const id = randomUUID();
    const get = await request(fixture.app).get(`/students/${id}/teacher`);
    expect(get.status).toBe(401);

    const post = await request(fixture.app)
      .post(`/students/${id}/teacher`)
      .send({ teacherId: randomUUID() });
    expect(post.status).toBe(401);

    const del = await request(fixture.app).delete(`/students/${id}/teacher`);
    expect(del.status).toBe(401);
  });

  it('returns 403 when TEACHER lacks assignments permissions', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const directorCookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    const student = await createStudent(
      directorCookie!,
      'alumno@academia.test',
    );
    const teacher = await createTeacher(
      directorCookie!,
      'docente@academia.test',
    );

    const teacherCookie = await loginAs(
      'docente@academia.test',
      'teacher-password-12',
    );

    const get = await request(fixture.app)
      .get(`/students/${student.id}/teacher`)
      .set('Cookie', teacherCookie!);
    expect(get.status).toBe(403);

    const post = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', teacherCookie!)
      .send({ teacherId: teacher.id });
    expect(post.status).toBe(403);

    const del = await request(fixture.app)
      .delete(`/students/${student.id}/teacher`)
      .set('Cookie', teacherCookie!);
    expect(del.status).toBe(403);
  });

  it('lets DIRECTOR assign, read, replace and unassign', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    const student = await createStudent(cookie!, 'alumno@academia.test');
    const teacherA = await createTeacher(cookie!, 'docente-a@academia.test');
    const teacherB = await createTeacher(cookie!, 'docente-b@academia.test');

    const assigned = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', cookie!)
      .send({ teacherId: teacherA.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.assignment).toMatchObject({
      studentId: student.id,
      teacherId: teacherA.id,
    });

    const persisted = await fixture.assignments.findByStudentId(student.id);
    expect(persisted?.teacherId).toBe(teacherA.id);

    const got = await request(fixture.app)
      .get(`/students/${student.id}/teacher`)
      .set('Cookie', cookie!);
    expect(got.status).toBe(200);
    expect(got.body.assignment.teacherId).toBe(teacherA.id);

    const replaced = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', cookie!)
      .send({ teacherId: teacherB.id });
    expect(replaced.status).toBe(200);
    expect(replaced.body.assignment.teacherId).toBe(teacherB.id);
    expect(
      (await fixture.assignments.findByStudentId(student.id))?.teacherId,
    ).toBe(teacherB.id);

    const removed = await request(fixture.app)
      .delete(`/students/${student.id}/teacher`)
      .set('Cookie', cookie!);
    expect(removed.status).toBe(204);
    expect(await fixture.assignments.findByStudentId(student.id)).toBeNull();
  });

  it('returns 404 for missing student or teacher', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    const teacher = await createTeacher(cookie!, 'docente@academia.test');

    const missingStudent = await request(fixture.app)
      .post(`/students/${randomUUID()}/teacher`)
      .set('Cookie', cookie!)
      .send({ teacherId: teacher.id });
    expect(missingStudent.status).toBe(404);

    const student = await createStudent(cookie!, 'alumno@academia.test');
    const missingTeacher = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', cookie!)
      .send({ teacherId: randomUUID() });
    expect(missingTeacher.status).toBe(404);
  });

  it('rejects inactive student and teacher', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    const student = await createStudent(cookie!, 'alumno@academia.test');
    const teacher = await createTeacher(cookie!, 'docente@academia.test');

    await request(fixture.app)
      .delete(`/students/${student.id}`)
      .set('Cookie', cookie!);

    const inactiveStudent = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', cookie!)
      .send({ teacherId: teacher.id });
    expect(inactiveStudent.status).toBe(400);

    const studentB = await createStudent(cookie!, 'alumno-b@academia.test');
    await request(fixture.app)
      .delete(`/teachers/${teacher.id}`)
      .set('Cookie', cookie!);

    const inactiveTeacher = await request(fixture.app)
      .post(`/students/${studentB.id}/teacher`)
      .set('Cookie', cookie!)
      .send({ teacherId: teacher.id });
    expect(inactiveTeacher.status).toBe(400);
  });

  it('rejects using a student id as teacherId (wrong role/profile)', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    const student = await createStudent(cookie!, 'alumno@academia.test');
    const otherStudent = await createStudent(cookie!, 'otro@academia.test');

    const response = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', cookie!)
      .send({ teacherId: otherStudent.id });
    expect(response.status).toBe(404);
  });

  it('allows a STUDENT to read own assignment but not another', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const directorCookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    const studentA = await createStudent(
      directorCookie!,
      'one@academia.test',
    );
    const studentB = await createStudent(
      directorCookie!,
      'two@academia.test',
    );
    const teacher = await createTeacher(
      directorCookie!,
      'docente@academia.test',
    );

    await request(fixture.app)
      .post(`/students/${studentA.id}/teacher`)
      .set('Cookie', directorCookie!)
      .send({ teacherId: teacher.id });
    await request(fixture.app)
      .post(`/students/${studentB.id}/teacher`)
      .set('Cookie', directorCookie!)
      .send({ teacherId: teacher.id });

    const ownCookie = await loginAs('one@academia.test', 'student-password-12');
    const own = await request(fixture.app)
      .get(`/students/${studentA.id}/teacher`)
      .set('Cookie', ownCookie!);
    expect(own.status).toBe(200);

    const other = await request(fixture.app)
      .get(`/students/${studentB.id}/teacher`)
      .set('Cookie', ownCookie!);
    expect(other.status).toBe(403);

    const mutate = await request(fixture.app)
      .post(`/students/${studentA.id}/teacher`)
      .set('Cookie', ownCookie!)
      .send({ teacherId: teacher.id });
    expect(mutate.status).toBe(403);
  });

  it('allows DIRECTOR to assign Student A to Teacher B', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    const student = await createStudent(cookie!, 'alumno@academia.test');
    const teacher = await createTeacher(cookie!, 'docente@academia.test');

    const response = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', cookie!)
      .send({ teacherId: teacher.id });

    expect(response.status).toBe(200);
    expect(response.body.assignment.teacherId).toBe(teacher.id);
  });

  it('rejects TEACHER self-assignment even with assignments.create and forged body', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const directorCookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    const student = await createStudent(
      directorCookie!,
      'alumno@academia.test',
    );
    const teacher = await createTeacher(
      directorCookie!,
      'docente@academia.test',
    );
    const otherTeacher = await createTeacher(
      directorCookie!,
      'otro-docente@academia.test',
    );

    fixture.administrativePermissions.grantRole(
      'TEACHER',
      'assignments',
      'create',
    );

    const teacherCookie = await loginAs(
      'docente@academia.test',
      'teacher-password-12',
    );

    const selfAssign = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', teacherCookie!)
      .send({
        teacherId: teacher.id,
        userId: otherTeacher.userId,
        actorId: otherTeacher.userId,
        role: 'DIRECTOR',
      });
    expect(selfAssign.status).toBe(400);
    expect(selfAssign.body).not.toMatchObject({
      assignment: expect.anything(),
    });
    expect(await fixture.assignments.findByStudentId(student.id)).toBeNull();

    const assignOther = await request(fixture.app)
      .post(`/students/${student.id}/teacher`)
      .set('Cookie', teacherCookie!)
      .send({ teacherId: otherTeacher.id });
    expect(assignOther.status).toBe(200);
    expect(assignOther.body.assignment.teacherId).toBe(otherTeacher.id);
  });
});
