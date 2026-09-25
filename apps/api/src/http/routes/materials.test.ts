import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Materials routes', () => {
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
      id: 'director-materials-1',
      email: 'directora-materials@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs(
      'directora-materials@academia.test',
      'director-password-12',
    ))!;
  }

  async function seedCourseContext(directorCookie: string): Promise<{
    courseId: string;
    otherCourseId: string;
    teacherId: string;
    otherTeacherId: string;
    studentId: string;
    outsiderStudentId: string;
    teacherCookie: string;
    otherTeacherCookie: string;
    studentCookie: string;
    outsiderStudentCookie: string;
  }> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', directorCookie)
      .send({
        name: 'Materials Course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);
    const courseId = course.body.course.id as string;

    const otherCourse = await request(fixture.app)
      .post('/courses')
      .set('Cookie', directorCookie)
      .send({
        name: 'Materials Other Course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(otherCourse.status).toBe(201);
    const otherCourseId = otherCourse.body.course.id as string;

    fixture.materials.seedCourse(courseId);
    fixture.materials.seedCourse(otherCourseId);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', directorCookie)
      .send({ courseId, name: 'Materials Group' });
    expect(group.status).toBe(201);

    const otherGroup = await request(fixture.app)
      .post('/groups')
      .set('Cookie', directorCookie)
      .send({ courseId: otherCourseId, name: 'Materials Other Group' });
    expect(otherGroup.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', directorCookie)
      .send({
        email: 'teacher-materials@academia.test',
        password: 'teacher-password-12',
        firstName: 'Tea',
        lastName: 'Cher',
        level: 'C1',
      });
    expect(teacher.status).toBe(201);
    const teacherId = teacher.body.teacher.id as string;

    const otherTeacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', directorCookie)
      .send({
        email: 'teacher-other-materials@academia.test',
        password: 'teacher-password-12',
        firstName: 'Other',
        lastName: 'Teacher',
        level: 'C1',
      });
    expect(otherTeacher.status).toBe(201);
    const otherTeacherId = otherTeacher.body.teacher.id as string;

    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/teacher`)
      .set('Cookie', directorCookie)
      .send({ teacherId });
    await request(fixture.app)
      .post(`/groups/${otherGroup.body.group.id}/teacher`)
      .set('Cookie', directorCookie)
      .send({ teacherId: otherTeacherId });

    fixture.materials.deps.teacherCourses.set(
      teacherId,
      new Set([courseId]),
    );
    fixture.materials.deps.teacherCourses.set(
      otherTeacherId,
      new Set([otherCourseId]),
    );

    const option = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', directorCookie)
      .send({ day: 'THURSDAY', startTime: '10:00', endTime: '12:00' });
    expect(option.status).toBe(201);
    await request(fixture.app)
      .patch(`/groups/${group.body.group.id}`)
      .set('Cookie', directorCookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });
    await request(fixture.app)
      .patch(`/groups/${otherGroup.body.group.id}`)
      .set('Cookie', directorCookie)
      .send({ scheduleOptionId: option.body.scheduleOption.id });

    const student = await request(fixture.app)
      .post('/students')
      .set('Cookie', directorCookie)
      .send({
        email: 'student-materials@academia.test',
        password: 'student-password-12',
        firstName: 'Stu',
        lastName: 'Dent',
        level: 'B1',
      });
    expect(student.status).toBe(201);
    const studentId = student.body.student.id as string;

    const outsider = await request(fixture.app)
      .post('/students')
      .set('Cookie', directorCookie)
      .send({
        email: 'outsider-materials@academia.test',
        password: 'student-password-12',
        firstName: 'Out',
        lastName: 'Sider',
        level: 'A1',
      });
    expect(outsider.status).toBe(201);
    const outsiderStudentId = outsider.body.student.id as string;

    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/students`)
      .set('Cookie', directorCookie)
      .send({ studentId });
    await request(fixture.app)
      .post(`/groups/${otherGroup.body.group.id}/students`)
      .set('Cookie', directorCookie)
      .send({ studentId: outsiderStudentId });

    fixture.materials.deps.studentCourses.set(
      studentId,
      new Set([courseId]),
    );
    fixture.materials.deps.studentCourses.set(
      outsiderStudentId,
      new Set([otherCourseId]),
    );

    return {
      courseId,
      otherCourseId,
      teacherId,
      otherTeacherId,
      studentId,
      outsiderStudentId,
      teacherCookie: (await loginAs(
        'teacher-materials@academia.test',
        'teacher-password-12',
      ))!,
      otherTeacherCookie: (await loginAs(
        'teacher-other-materials@academia.test',
        'teacher-password-12',
      ))!,
      studentCookie: (await loginAs(
        'student-materials@academia.test',
        'student-password-12',
      ))!,
      outsiderStudentCookie: (await loginAs(
        'outsider-materials@academia.test',
        'student-password-12',
      ))!,
    };
  }

  it('returns 401 when unauthenticated', async () => {
    expect((await request(fixture.app).get('/materials')).status).toBe(401);
    expect(
      (await request(fixture.app).post('/materials').send({})).status,
    ).toBe(401);
  });

  it('lets DIRECTOR create LINK, list, get and download', async () => {
    const director = await seedDirector();
    const ctx = await seedCourseContext(director);

    const created = await request(fixture.app)
      .post('/materials')
      .set('Cookie', director)
      .send({
        title: 'Lesson link',
        kind: 'LINK',
        externalUrl: 'https://example.com/lesson',
        courseId: ctx.courseId,
      });
    expect(created.status).toBe(201);
    expect(created.body.material.uploadStatus).toBe('READY');
    expect(created.body.material).not.toHaveProperty('storageKey');

    const listed = await request(fixture.app)
      .get(`/materials?courseId=${ctx.courseId}`)
      .set('Cookie', director);
    expect(listed.status).toBe(200);
    expect(listed.body.materials).toHaveLength(1);

    const got = await request(fixture.app)
      .get(`/materials/${created.body.material.id}`)
      .set('Cookie', director);
    expect(got.status).toBe(200);
    expect(got.body.material.id).toBe(created.body.material.id);

    const download = await request(fixture.app)
      .get(`/materials/${created.body.material.id}/download`)
      .set('Cookie', director);
    expect(download.status).toBe(200);
    expect(download.body).toMatchObject({
      kind: 'LINK',
      externalUrl: 'https://example.com/lesson',
    });
  });

  it('completes FILE upload intent → READY → signed download', async () => {
    const director = await seedDirector();
    const ctx = await seedCourseContext(director);

    const intent = await request(fixture.app)
      .post('/materials/uploads')
      .set('Cookie', director)
      .send({
        title: 'Handout',
        mimeType: 'application/pdf',
        sizeBytes: 24,
        originalFilename: 'handout.pdf',
        courseId: ctx.courseId,
      });
    expect(intent.status).toBe(201);
    expect(intent.body.material.uploadStatus).toBe('PENDING');
    expect(intent.body.uploadUrl).toContain('storage.test/upload');

    const record = fixture.materials.records.get(intent.body.material.id)!;
    expect(record.storageKey).toBeTruthy();

    const pdfBody = Buffer.from('%PDF-1.7\n% test content\n');
    fixture.storage.put(record.storageKey!, pdfBody, 'application/pdf');

    const completed = await request(fixture.app)
      .post(`/materials/${intent.body.material.id}/complete`)
      .set('Cookie', director);
    expect(completed.status).toBe(200);
    expect(completed.body.material.uploadStatus).toBe('READY');

    const download = await request(fixture.app)
      .get(`/materials/${intent.body.material.id}/download`)
      .set('Cookie', director);
    expect(download.status).toBe(200);
    expect(download.body.kind).toBe('FILE');
    expect(download.body.downloadUrl).toContain('storage.test/download');
    expect(download.body.expiresInSeconds).toBe(120);
  });

  it('lets entitled student list/get/download READY; 403 on PENDING and other course', async () => {
    const director = await seedDirector();
    const ctx = await seedCourseContext(director);

    const ready = await request(fixture.app)
      .post('/materials')
      .set('Cookie', director)
      .send({
        title: 'Ready',
        kind: 'LINK',
        externalUrl: 'https://example.com/ready',
        courseId: ctx.courseId,
      });
    expect(ready.status).toBe(201);

    const pending = await request(fixture.app)
      .post('/materials/uploads')
      .set('Cookie', director)
      .send({
        title: 'Pending',
        mimeType: 'application/pdf',
        sizeBytes: 20,
        originalFilename: 'p.pdf',
        courseId: ctx.courseId,
      });
    expect(pending.status).toBe(201);

    const listed = await request(fixture.app)
      .get(`/materials?courseId=${ctx.courseId}`)
      .set('Cookie', ctx.studentCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.materials.map((m: { id: string }) => m.id)).toEqual([
      ready.body.material.id,
    ]);

    expect(
      (
        await request(fixture.app)
          .get(`/materials/${ready.body.material.id}`)
          .set('Cookie', ctx.studentCookie)
      ).status,
    ).toBe(200);

    expect(
      (
        await request(fixture.app)
          .get(`/materials/${ready.body.material.id}/download`)
          .set('Cookie', ctx.studentCookie)
      ).status,
    ).toBe(200);

    expect(
      (
        await request(fixture.app)
          .get(`/materials/${pending.body.material.id}`)
          .set('Cookie', ctx.studentCookie)
      ).status,
    ).toBe(403);

    expect(
      (
        await request(fixture.app)
          .get(`/materials/${ready.body.material.id}`)
          .set('Cookie', ctx.outsiderStudentCookie)
      ).status,
    ).toBe(403);
  });

  it('forbids Teacher A from managing Teacher B material', async () => {
    const director = await seedDirector();
    const ctx = await seedCourseContext(director);

    const created = await request(fixture.app)
      .post('/materials')
      .set('Cookie', ctx.teacherCookie)
      .send({
        title: 'Teacher A link',
        kind: 'LINK',
        externalUrl: 'https://example.com/a',
        courseId: ctx.courseId,
      });
    expect(created.status).toBe(201);

    expect(
      (
        await request(fixture.app)
          .patch(`/materials/${created.body.material.id}`)
          .set('Cookie', ctx.otherTeacherCookie)
          .send({ title: 'Hijack' })
      ).status,
    ).toBe(403);

    expect(
      (
        await request(fixture.app)
          .delete(`/materials/${created.body.material.id}`)
          .set('Cookie', ctx.otherTeacherCookie)
      ).status,
    ).toBe(403);

    expect(
      (
        await request(fixture.app)
          .post('/materials')
          .set('Cookie', ctx.otherTeacherCookie)
          .send({
            title: 'On A course',
            kind: 'LINK',
            externalUrl: 'https://example.com/b',
            courseId: ctx.courseId,
          })
      ).status,
    ).toBe(403);
  });

  it('ADMINISTRATIVE without grant → 403; with materials.create/read/update → ok', async () => {
    const director = await seedDirector();
    const ctx = await seedCourseContext(director);

    fixture.users.seed({
      id: 'admin-materials-1',
      email: 'admin-materials@academia.test',
      name: 'ADMINISTRATIVE',
      role: 'ADMINISTRATIVE',
      isActive: true,
      passwordHash: await hashPassword('admin-password-12'),
    });
    const adminCookie = (await loginAs(
      'admin-materials@academia.test',
      'admin-password-12',
    ))!;

    fixture.administrativePermissions.clear();

    expect(
      (
        await request(fixture.app)
          .get(`/materials?courseId=${ctx.courseId}`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(403);

    expect(
      (
        await request(fixture.app)
          .post('/materials')
          .set('Cookie', adminCookie)
          .send({
            title: 'No grant',
            kind: 'LINK',
            externalUrl: 'https://example.com/x',
            courseId: ctx.courseId,
          })
      ).status,
    ).toBe(403);

    await fixture.administrativePermissions.grant('materials', 'read');
    await fixture.administrativePermissions.grant('materials', 'create');
    await fixture.administrativePermissions.grant('materials', 'update');

    const created = await request(fixture.app)
      .post('/materials')
      .set('Cookie', adminCookie)
      .send({
        title: 'Admin link',
        kind: 'LINK',
        externalUrl: 'https://example.com/admin',
        courseId: ctx.courseId,
      });
    expect(created.status).toBe(201);

    expect(
      (
        await request(fixture.app)
          .get(`/materials?courseId=${ctx.courseId}`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);

    const patched = await request(fixture.app)
      .patch(`/materials/${created.body.material.id}`)
      .set('Cookie', adminCookie)
      .send({ title: 'Admin link updated' });
    expect(patched.status).toBe(200);
    expect(patched.body.material.title).toBe('Admin link updated');
  });

  it('forbids student POST', async () => {
    const director = await seedDirector();
    const ctx = await seedCourseContext(director);

    expect(
      (
        await request(fixture.app)
          .post('/materials')
          .set('Cookie', ctx.studentCookie)
          .send({
            title: 'Nope',
            kind: 'LINK',
            externalUrl: 'https://example.com/no',
            courseId: ctx.courseId,
          })
      ).status,
    ).toBe(403);
  });

  it('soft deletes → 204 then get 404', async () => {
    const director = await seedDirector();
    const ctx = await seedCourseContext(director);

    const created = await request(fixture.app)
      .post('/materials')
      .set('Cookie', director)
      .send({
        title: 'Delete me',
        kind: 'LINK',
        externalUrl: 'https://example.com/del',
        courseId: ctx.courseId,
      });
    expect(created.status).toBe(201);

    const deleted = await request(fixture.app)
      .delete(`/materials/${created.body.material.id}`)
      .set('Cookie', director);
    expect(deleted.status).toBe(204);

    expect(
      (
        await request(fixture.app)
          .get(`/materials/${created.body.material.id}`)
          .set('Cookie', director)
      ).status,
    ).toBe(404);
  });

  it('list without scope or with both scopes → 400', async () => {
    const director = await seedDirector();
    const ctx = await seedCourseContext(director);

    expect(
      (
        await request(fixture.app)
          .get('/materials')
          .set('Cookie', director)
      ).status,
    ).toBe(400);

    expect(
      (
        await request(fixture.app)
          .get(
            `/materials?courseId=${ctx.courseId}&classSessionId=33333333-3333-4333-8333-333333333333`,
          )
          .set('Cookie', director)
      ).status,
    ).toBe(400);
  });
});
