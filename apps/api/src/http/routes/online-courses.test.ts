import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Online courses routes', () => {
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
      id: 'director-online-1',
      email: 'director-online@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs(
      'director-online@academia.test',
      'director-password-12',
    ))!;
  }

  async function seedStudent(
    directorCookie: string,
    email: string,
  ): Promise<{ studentId: string; cookie: string }> {
    const created = await request(fixture.app)
      .post('/students')
      .set('Cookie', directorCookie)
      .send({
        email,
        password: 'student-password-12',
        firstName: 'Stu',
        lastName: 'Dent',
        level: 'A1',
      });
    expect(created.status).toBe(201);
    const cookie = (await loginAs(email, 'student-password-12'))!;
    return { studentId: created.body.student.id as string, cookie };
  }

  async function buildPublishedCourse(
    directorCookie: string,
    options?: {
      slug?: string;
      accessMode?: 'OPEN' | 'LINEAR';
      secondLesson?: boolean;
    },
  ): Promise<{
    courseId: string;
    slug: string;
    moduleId: string;
    lessonId: string;
    secondLessonId?: string;
    assetId: string;
  }> {
    const slug = options?.slug ?? 'intro-spanish';
    const created = await request(fixture.app)
      .post('/online-courses')
      .set('Cookie', directorCookie)
      .send({
        title: 'Intro Spanish',
        slug,
        accessMode: options?.accessMode ?? 'OPEN',
      });
    expect(created.status).toBe(201);
    const courseId = created.body.course.id as string;

    const mod = await request(fixture.app)
      .post(`/online-courses/${courseId}/modules`)
      .set('Cookie', directorCookie)
      .send({ title: 'Module 1' });
    expect(mod.status).toBe(201);
    const moduleId = mod.body.module.id as string;

    const lesson = await request(fixture.app)
      .post(`/online-courses/${courseId}/modules/${moduleId}/lessons`)
      .set('Cookie', directorCookie)
      .send({
        title: 'Lesson 1',
        status: 'PUBLISHED',
        isRequired: true,
      });
    expect(lesson.status).toBe(201);
    const lessonId = lesson.body.lesson.id as string;

    let secondLessonId: string | undefined;
    if (options?.secondLesson) {
      const lesson2 = await request(fixture.app)
        .post(`/online-courses/${courseId}/modules/${moduleId}/lessons`)
        .set('Cookie', directorCookie)
        .send({
          title: 'Lesson 2',
          status: 'PUBLISHED',
          isRequired: true,
        });
      expect(lesson2.status).toBe(201);
      secondLessonId = lesson2.body.lesson.id as string;
    }

    const asset = await request(fixture.app)
      .post(`/online-courses/lessons/${lessonId}/assets`)
      .set('Cookie', directorCookie)
      .send({
        kind: 'TEXT',
        title: 'Welcome',
        bodyText: 'Hola mundo',
      });
    expect(asset.status).toBe(201);
    const assetId = asset.body.asset.id as string;

    const published = await request(fixture.app)
      .post(`/online-courses/${courseId}/publish`)
      .set('Cookie', directorCookie);
    expect(published.status).toBe(200);
    expect(published.body.course.status).toBe('PUBLISHED');

    return { courseId, slug, moduleId, lessonId, secondLessonId, assetId };
  }

  it('lets director create course, module, lesson, TEXT asset and publish', async () => {
    const director = await seedDirector();
    const built = await buildPublishedCourse(director);
    expect(built.courseId).toBeTruthy();
    expect(built.assetId).toBeTruthy();

    const listed = await request(fixture.app)
      .get('/online-courses')
      .set('Cookie', director);
    expect(listed.status).toBe(200);
    expect(listed.body.courses).toHaveLength(1);
    expect(listed.body.courses[0].status).toBe('PUBLISHED');
  });

  it('returns 403 when student without access requests lesson content', async () => {
    const director = await seedDirector();
    const { slug, lessonId } = await buildPublishedCourse(director);
    const student = await seedStudent(director, 'no-access@academia.test');

    const detail = await request(fixture.app)
      .get(`/students/me/online-courses/${slug}/lessons/${lessonId}`)
      .set('Cookie', student.cookie);
    expect(detail.status).toBe(403);
  });

  it('lets student free-enroll then access lesson content', async () => {
    const director = await seedDirector();
    const { slug, lessonId } = await buildPublishedCourse(director);
    const student = await seedStudent(director, 'free@academia.test');

    const enroll = await request(fixture.app)
      .post(`/students/me/online-courses/${slug}/enroll-free`)
      .set('Cookie', student.cookie);
    expect(enroll.status).toBe(201);

    const detail = await request(fixture.app)
      .get(`/students/me/online-courses/${slug}/lessons/${lessonId}`)
      .set('Cookie', student.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.lesson.id).toBe(lessonId);
    expect(detail.body.assets).toHaveLength(1);
    expect(detail.body.assets[0].bodyText).toBe('Hola mundo');
  });

  it('persists progress start and complete', async () => {
    const director = await seedDirector();
    const { slug, lessonId } = await buildPublishedCourse(director);
    const student = await seedStudent(director, 'progress@academia.test');

    await request(fixture.app)
      .post(`/students/me/online-courses/${slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const started = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${lessonId}/progress`,
      )
      .set('Cookie', student.cookie)
      .send({ status: 'IN_PROGRESS' });
    expect(started.status).toBe(200);
    expect(started.body.progress.status).toBe('IN_PROGRESS');

    const completed = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${lessonId}/progress`,
      )
      .set('Cookie', student.cookie)
      .send({ status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect(completed.body.progress.status).toBe('COMPLETED');

    const outline = await request(fixture.app)
      .get(`/students/me/online-courses/${slug}`)
      .set('Cookie', student.cookie);
    expect(outline.status).toBe(200);
    expect(outline.body.progressPercent).toBe(100);
    expect(
      outline.body.modules[0].lessons[0].progress.status,
    ).toBe('COMPLETED');
  });

  it('LINEAR locks second lesson until first required is completed', async () => {
    const director = await seedDirector();
    const { slug, lessonId, secondLessonId } = await buildPublishedCourse(
      director,
      { slug: 'linear-course', accessMode: 'LINEAR', secondLesson: true },
    );
    expect(secondLessonId).toBeTruthy();
    const student = await seedStudent(director, 'linear@academia.test');

    await request(fixture.app)
      .post(`/students/me/online-courses/${slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const locked = await request(fixture.app)
      .get(`/students/me/online-courses/${slug}/lessons/${secondLessonId}`)
      .set('Cookie', student.cookie);
    expect(locked.status).toBe(403);

    await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${lessonId}/progress`,
      )
      .set('Cookie', student.cookie)
      .send({ status: 'COMPLETED' });

    const unlocked = await request(fixture.app)
      .get(`/students/me/online-courses/${slug}/lessons/${secondLessonId}`)
      .set('Cookie', student.cookie);
    expect(unlocked.status).toBe(200);
  });

  it('admin quiz upsert; student public quiz hides correct answers; submit works', async () => {
    const director = await seedDirector();
    const { slug, lessonId } = await buildPublishedCourse(director, {
      slug: 'quiz-course',
    });
    const student = await seedStudent(director, 'quiz@academia.test');

    const upsert = await request(fixture.app)
      .put(`/online-courses/lessons/${lessonId}/quiz`)
      .set('Cookie', director)
      .send({
        title: 'Check-in',
        passScorePercent: 50,
        questions: [
          {
            prompt: 'Capital of Spain?',
            type: 'SINGLE_CHOICE',
            options: [
              { label: 'Madrid', isCorrect: true },
              { label: 'Lisbon', isCorrect: false },
            ],
          },
        ],
      });
    expect(upsert.status).toBe(200);
    expect(upsert.body.quiz.questions[0].options[0].isCorrect).toBe(true);

    await request(fixture.app)
      .post(`/students/me/online-courses/${slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const publicQuiz = await request(fixture.app)
      .get(`/students/me/online-courses/${slug}/lessons/${lessonId}/quiz`)
      .set('Cookie', student.cookie);
    expect(publicQuiz.status).toBe(200);
    expect(publicQuiz.body.quiz.questions[0].options[0].isCorrect).toBeUndefined();
    expect(publicQuiz.body.quiz.questions[0].correctText).toBeUndefined();

    const optionId = publicQuiz.body.quiz.questions[0].options[0].id as string;
    const submit = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${lessonId}/quiz/submit`,
      )
      .set('Cookie', student.cookie)
      .send({
        answers: [
          {
            questionId: publicQuiz.body.quiz.questions[0].id,
            selectedOptionIds: [optionId],
          },
        ],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.passed).toBe(true);
    expect(submit.body.scorePercent).toBe(100);
  });

  it('visitor GET /public/online-courses only sees PUBLISHED; draft excluded', async () => {
    const director = await seedDirector();
    await buildPublishedCourse(director, { slug: 'public-live' });

    const draft = await request(fixture.app)
      .post('/online-courses')
      .set('Cookie', director)
      .send({ title: 'Draft Course', slug: 'still-draft' });
    expect(draft.status).toBe(201);

    const publicList = await request(fixture.app).get('/public/online-courses');
    expect(publicList.status).toBe(200);
    expect(publicList.body.courses).toHaveLength(1);
    expect(publicList.body.courses[0].slug).toBe('public-live');

    const draftGet = await request(fixture.app).get(
      '/public/online-courses/still-draft',
    );
    expect(draftGet.status).toBe(404);

    const liveGet = await request(fixture.app).get(
      '/public/online-courses/public-live',
    );
    expect(liveGet.status).toBe(200);
    expect(liveGet.body.course.modules).toHaveLength(1);
  });

  it('returns 403 when ADMINISTRATIVE without grant cannot create', async () => {
    fixture.users.seed({
      id: 'admin-online-1',
      email: 'admin-online@academia.test',
      name: 'ADMINISTRATIVE',
      role: 'ADMINISTRATIVE',
      isActive: true,
      passwordHash: await hashPassword('admin-password-12'),
    });
    const cookie = await loginAs(
      'admin-online@academia.test',
      'admin-password-12',
    );

    const created = await request(fixture.app)
      .post('/online-courses')
      .set('Cookie', cookie!)
      .send({ title: 'Nope', slug: 'nope-course' });
    expect(created.status).toBe(403);
  });
});
