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
        description: 'Curso introductorio de prueba.',
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

    if (secondLessonId) {
      const asset2 = await request(fixture.app)
        .post(`/online-courses/lessons/${secondLessonId}/assets`)
        .set('Cookie', directorCookie)
        .send({
          kind: 'TEXT',
          title: 'Lesson 2 text',
          bodyText: 'Segunda lección',
        });
      expect(asset2.status).toBe(201);
    }

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

  it('LINEAR blocks quiz submit and submissions on locked lesson; unlocks after progress', async () => {
    const director = await seedDirector();
    const { courseId, slug, moduleId, lessonId, secondLessonId } =
      await buildPublishedCourse(director, {
        slug: 'linear-eval-lock',
        accessMode: 'LINEAR',
        secondLesson: true,
      });
    expect(secondLessonId).toBeTruthy();

    const enableSubmit = await request(fixture.app)
      .patch(
        `/online-courses/${courseId}/modules/${moduleId}/lessons/${secondLessonId}`,
      )
      .set('Cookie', director)
      .send({ acceptsSubmission: true });
    expect(enableSubmit.status).toBe(200);

    const upsert = await request(fixture.app)
      .put(`/online-courses/lessons/${secondLessonId}/quiz`)
      .set('Cookie', director)
      .send({
        title: 'Locked quiz',
        passScorePercent: 50,
        questions: [
          {
            prompt: '2+2?',
            type: 'SINGLE_CHOICE',
            options: [
              { label: '4', isCorrect: true },
              { label: '5', isCorrect: false },
            ],
          },
        ],
      });
    expect(upsert.status).toBe(200);
    const questionId = upsert.body.quiz.questions[0].id as string;
    const optionId = upsert.body.quiz.questions[0].options[0].id as string;

    const student = await seedStudent(director, 'linear-eval@academia.test');
    await request(fixture.app)
      .post(`/students/me/online-courses/${slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const firstLessonOk = await request(fixture.app)
      .get(`/students/me/online-courses/${slug}/lessons/${lessonId}`)
      .set('Cookie', student.cookie);
    expect(firstLessonOk.status).toBe(200);

    const quizGetLocked = await request(fixture.app)
      .get(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/quiz`,
      )
      .set('Cookie', student.cookie);
    expect(quizGetLocked.status).toBe(403);

    const quizSubmitLocked = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/quiz/submit`,
      )
      .set('Cookie', student.cookie)
      .send({
        answers: [
          { questionId, selectedOptionIds: [optionId] },
        ],
      });
    expect(quizSubmitLocked.status).toBe(403);
    expect(quizSubmitLocked.body.error.code).toBe('FORBIDDEN');

    const submissionLocked = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/submissions`,
      )
      .set('Cookie', student.cookie)
      .send({ bodyText: 'Should not persist' });
    expect(submissionLocked.status).toBe(403);
    expect(submissionLocked.body.error.code).toBe('FORBIDDEN');

    const listLocked = await request(fixture.app)
      .get(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/submissions`,
      )
      .set('Cookie', student.cookie);
    expect(listLocked.status).toBe(403);

    // Completing lesson 1 unlocks lesson 2 evaluations.
    await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${lessonId}/progress`,
      )
      .set('Cookie', student.cookie)
      .send({ status: 'COMPLETED' });

    const quizSubmitOk = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/quiz/submit`,
      )
      .set('Cookie', student.cookie)
      .send({
        answers: [
          { questionId, selectedOptionIds: [optionId] },
        ],
      });
    expect(quizSubmitOk.status).toBe(200);
    expect(quizSubmitOk.body.passed).toBe(true);

    const submissionOk = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/submissions`,
      )
      .set('Cookie', student.cookie)
      .send({ bodyText: 'Unlocked delivery' });
    expect(submissionOk.status).toBe(201);

    const listOk = await request(fixture.app)
      .get(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/submissions`,
      )
      .set('Cookie', student.cookie);
    expect(listOk.status).toBe(200);
    expect(listOk.body.submissions).toHaveLength(1);
    expect(listOk.body.submissions[0].bodyText).toBe('Unlocked delivery');
  });

  it('OPEN course allows quiz submit on later lessons without prior completion', async () => {
    const director = await seedDirector();
    const { slug, secondLessonId } = await buildPublishedCourse(director, {
      slug: 'open-eval-free',
      accessMode: 'OPEN',
      secondLesson: true,
    });
    expect(secondLessonId).toBeTruthy();

    const upsert = await request(fixture.app)
      .put(`/online-courses/lessons/${secondLessonId}/quiz`)
      .set('Cookie', director)
      .send({
        title: 'Open quiz',
        passScorePercent: 50,
        questions: [
          {
            prompt: 'OK?',
            type: 'SINGLE_CHOICE',
            options: [
              { label: 'Yes', isCorrect: true },
              { label: 'No', isCorrect: false },
            ],
          },
        ],
      });
    expect(upsert.status).toBe(200);
    const questionId = upsert.body.quiz.questions[0].id as string;
    const optionId = upsert.body.quiz.questions[0].options[0].id as string;

    const student = await seedStudent(director, 'open-eval@academia.test');
    await request(fixture.app)
      .post(`/students/me/online-courses/${slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const submit = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/quiz/submit`,
      )
      .set('Cookie', student.cookie)
      .send({
        answers: [
          { questionId, selectedOptionIds: [optionId] },
        ],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.passed).toBe(true);
  });

  it('rejects student quiz submit for a course without enrollment', async () => {
    const director = await seedDirector();
    const { slug, lessonId } = await buildPublishedCourse(director, {
      slug: 'no-enroll-quiz',
    });
    const upsert = await request(fixture.app)
      .put(`/online-courses/lessons/${lessonId}/quiz`)
      .set('Cookie', director)
      .send({
        title: 'Gate',
        passScorePercent: 50,
        questions: [
          {
            prompt: 'Q',
            type: 'SINGLE_CHOICE',
            options: [
              { label: 'A', isCorrect: true },
              { label: 'B', isCorrect: false },
            ],
          },
        ],
      });
    expect(upsert.status).toBe(200);

    const student = await seedStudent(director, 'no-enroll@academia.test');
    const submit = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${lessonId}/quiz/submit`,
      )
      .set('Cookie', student.cookie)
      .send({
        answers: [
          {
            questionId: upsert.body.quiz.questions[0].id,
            selectedOptionIds: [upsert.body.quiz.questions[0].options[0].id],
          },
        ],
      });
    expect(submit.status).toBe(403);
  });

  it('rejected LINEAR submission does not create a row; prior submissions unchanged', async () => {
    const director = await seedDirector();
    const { courseId, slug, moduleId, lessonId, secondLessonId } =
      await buildPublishedCourse(director, {
        slug: 'linear-submit-idempotent',
        accessMode: 'LINEAR',
        secondLesson: true,
      });
    expect(secondLessonId).toBeTruthy();

    await request(fixture.app)
      .patch(
        `/online-courses/${courseId}/modules/${moduleId}/lessons/${secondLessonId}`,
      )
      .set('Cookie', director)
      .send({ acceptsSubmission: true });

    const student = await seedStudent(
      director,
      'linear-submit-keep@academia.test',
    );
    await request(fixture.app)
      .post(`/students/me/online-courses/${slug}/enroll-free`)
      .set('Cookie', student.cookie);

    // Unlock, create one submission, then re-lock scenario is N/A — instead:
    // complete lesson1, submit once, then try submitting to a *different* locked
    // path is unnecessary. Verify blocked create leaves list empty.
    const blocked = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/submissions`,
      )
      .set('Cookie', student.cookie)
      .send({ bodyText: 'blocked-before-unlock' });
    expect(blocked.status).toBe(403);

    await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${lessonId}/progress`,
      )
      .set('Cookie', student.cookie)
      .send({ status: 'COMPLETED' });

    const created = await request(fixture.app)
      .post(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/submissions`,
      )
      .set('Cookie', student.cookie)
      .send({ bodyText: 'kept-after-unlock' });
    expect(created.status).toBe(201);
    const keptId = created.body.submission.id as string;

    // Forge progression skip: use another student without unlock — already covered.
    // Re-assert own list still has exactly the unlocked submission (no ghost from 403).
    const list = await request(fixture.app)
      .get(
        `/students/me/online-courses/${slug}/lessons/${secondLessonId}/submissions`,
      )
      .set('Cookie', student.cookie);
    expect(list.status).toBe(200);
    expect(list.body.submissions).toHaveLength(1);
    expect(list.body.submissions[0].id).toBe(keptId);
    expect(list.body.submissions[0].bodyText).toBe('kept-after-unlock');
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

  it('rejects publish of empty course and keeps DRAFT (POST /publish)', async () => {
    const director = await seedDirector();
    const created = await request(fixture.app)
      .post('/online-courses')
      .set('Cookie', director)
      .send({
        title: 'Vacío',
        slug: 'publish-empty',
        description: 'Tiene descripción pero sin estructura.',
      });
    expect(created.status).toBe(201);
    const courseId = created.body.course.id as string;

    const published = await request(fixture.app)
      .post(`/online-courses/${courseId}/publish`)
      .set('Cookie', director);
    expect(published.status).toBe(400);
    expect(published.body.error.message).toMatch(/módulo/i);

    const again = await request(fixture.app)
      .get(`/online-courses/${courseId}`)
      .set('Cookie', director);
    expect(again.status).toBe(200);
    expect(again.body.course.status).toBe('DRAFT');
  });

  it('rejects direct PATCH status=PUBLISHED when not ready', async () => {
    const director = await seedDirector();
    const created = await request(fixture.app)
      .post('/online-courses')
      .set('Cookie', director)
      .send({
        title: 'Patch bypass',
        slug: 'patch-publish-bypass',
        description: 'Descripción ok.',
      });
    expect(created.status).toBe(201);
    const courseId = created.body.course.id as string;

    const patched = await request(fixture.app)
      .patch(`/online-courses/${courseId}`)
      .set('Cookie', director)
      .send({ status: 'PUBLISHED' });
    expect(patched.status).toBe(400);
    expect(patched.body.error.message).toMatch(/módulo/i);

    const again = await request(fixture.app)
      .get(`/online-courses/${courseId}`)
      .set('Cookie', director);
    expect(again.body.course.status).toBe('DRAFT');
  });

  it('rejects publish when published lesson has no content', async () => {
    const director = await seedDirector();
    const created = await request(fixture.app)
      .post('/online-courses')
      .set('Cookie', director)
      .send({
        title: 'Sin contenido',
        slug: 'publish-no-content',
        description: 'Descripción ok.',
      });
    const courseId = created.body.course.id as string;
    const mod = await request(fixture.app)
      .post(`/online-courses/${courseId}/modules`)
      .set('Cookie', director)
      .send({ title: 'M1' });
    const moduleId = mod.body.module.id as string;
    await request(fixture.app)
      .post(`/online-courses/${courseId}/modules/${moduleId}/lessons`)
      .set('Cookie', director)
      .send({ title: 'L1', status: 'PUBLISHED' });

    const published = await request(fixture.app)
      .post(`/online-courses/${courseId}/publish`)
      .set('Cookie', director);
    expect(published.status).toBe(400);
    expect(published.body.error.message).toMatch(/no tiene contenido/i);

    const again = await request(fixture.app)
      .get(`/online-courses/${courseId}`)
      .set('Cookie', director);
    expect(again.body.course.status).toBe('DRAFT');
  });

  it('publishes FREE OPEN and LINEAR courses when structure is valid', async () => {
    const director = await seedDirector();
    for (const accessMode of ['OPEN', 'LINEAR'] as const) {
      const built = await buildPublishedCourse(director, {
        slug: `valid-${accessMode.toLowerCase()}`,
        accessMode,
      });
      const got = await request(fixture.app)
        .get(`/online-courses/${built.courseId}`)
        .set('Cookie', director);
      expect(got.body.course.status).toBe('PUBLISHED');
      expect(got.body.course.accessMode).toBe(accessMode);
      expect(got.body.course.amountMinor).toBeNull();
    }
  });

  it('publish with existing student access does not revoke enrollment', async () => {
    const director = await seedDirector();
    const created = await request(fixture.app)
      .post('/online-courses')
      .set('Cookie', director)
      .send({
        title: 'Con alumno',
        slug: 'publish-with-student',
        description: 'Descripción ok.',
      });
    const courseId = created.body.course.id as string;
    const mod = await request(fixture.app)
      .post(`/online-courses/${courseId}/modules`)
      .set('Cookie', director)
      .send({ title: 'M1' });
    const moduleId = mod.body.module.id as string;
    const lesson = await request(fixture.app)
      .post(`/online-courses/${courseId}/modules/${moduleId}/lessons`)
      .set('Cookie', director)
      .send({ title: 'L1', status: 'PUBLISHED' });
    await request(fixture.app)
      .post(`/online-courses/lessons/${lesson.body.lesson.id}/assets`)
      .set('Cookie', director)
      .send({ kind: 'TEXT', title: 'T', bodyText: 'Hola' });

    const student = await seedStudent(director, 'pre-enroll@academia.test');
    const grant = await request(fixture.app)
      .post(`/online-courses/${courseId}/access`)
      .set('Cookie', director)
      .send({ studentId: student.studentId });
    expect(grant.status).toBe(201);

    const published = await request(fixture.app)
      .post(`/online-courses/${courseId}/publish`)
      .set('Cookie', director);
    expect(published.status).toBe(200);
    expect(published.body.course.status).toBe('PUBLISHED');

    const detail = await request(fixture.app)
      .get(`/students/me/online-courses/publish-with-student`)
      .set('Cookie', student.cookie);
    expect(detail.status).toBe(200);
  });

  it('soft-deleting a module blocks student lesson/quiz/submissions but keeps history (OPEN)', async () => {
    const director = await seedDirector();
    const built = await buildPublishedCourse(director, {
      slug: 'soft-mod-open',
      accessMode: 'OPEN',
    });
    const enable = await request(fixture.app)
      .patch(
        `/online-courses/${built.courseId}/modules/${built.moduleId}/lessons/${built.lessonId}`,
      )
      .set('Cookie', director)
      .send({ acceptsSubmission: true });
    expect(enable.status).toBe(200);

    const upsert = await request(fixture.app)
      .put(`/online-courses/lessons/${built.lessonId}/quiz`)
      .set('Cookie', director)
      .send({
        title: 'Q',
        passScorePercent: 50,
        questions: [
          {
            prompt: 'OK?',
            type: 'SINGLE_CHOICE',
            options: [
              { label: 'Yes', isCorrect: true },
              { label: 'No', isCorrect: false },
            ],
          },
        ],
      });
    expect(upsert.status).toBe(200);
    const questionId = upsert.body.quiz.questions[0].id as string;
    const optionId = upsert.body.quiz.questions[0].options[0].id as string;

    const student = await seedStudent(director, 'soft-mod-open@academia.test');
    await request(fixture.app)
      .post(`/students/me/online-courses/${built.slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const progressed = await request(fixture.app)
      .post(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/progress`,
      )
      .set('Cookie', student.cookie)
      .send({ status: 'COMPLETED' });
    expect(progressed.status).toBe(200);

    const submitted = await request(fixture.app)
      .post(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/submissions`,
      )
      .set('Cookie', student.cookie)
      .send({ bodyText: 'histórico' });
    expect(submitted.status).toBe(201);
    const submissionId = submitted.body.submission.id as string;

    const quizOk = await request(fixture.app)
      .post(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/quiz/submit`,
      )
      .set('Cookie', student.cookie)
      .send({
        answers: [{ questionId, selectedOptionIds: [optionId] }],
      });
    expect(quizOk.status).toBe(200);

    const soft = await request(fixture.app)
      .patch(
        `/online-courses/${built.courseId}/modules/${built.moduleId}`,
      )
      .set('Cookie', director)
      .send({ isActive: false });
    expect(soft.status).toBe(200);
    expect(soft.body.module.isActive).toBe(false);

    const lessonGet = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}`,
      )
      .set('Cookie', student.cookie);
    expect(lessonGet.status).toBe(404);

    const assetGet = await request(fixture.app)
      .get(
        `/students/me/online-courses/assets/${built.assetId}/download`,
      )
      .set('Cookie', student.cookie);
    expect(assetGet.status).toBe(404);

    const quizGet = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/quiz`,
      )
      .set('Cookie', student.cookie);
    expect(quizGet.status).toBe(404);

    const quizSubmit = await request(fixture.app)
      .post(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/quiz/submit`,
      )
      .set('Cookie', student.cookie)
      .send({
        answers: [{ questionId, selectedOptionIds: [optionId] }],
      });
    expect(quizSubmit.status).toBe(404);

    const listSubs = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/submissions`,
      )
      .set('Cookie', student.cookie);
    expect(listSubs.status).toBe(404);

    const progressAgain = await request(fixture.app)
      .post(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/progress`,
      )
      .set('Cookie', student.cookie)
      .send({ status: 'IN_PROGRESS' });
    expect(progressAgain.status).toBe(404);

    // Restore module → lesson content available again; history untouched.
    const restore = await request(fixture.app)
      .patch(
        `/online-courses/${built.courseId}/modules/${built.moduleId}`,
      )
      .set('Cookie', director)
      .send({ isActive: true });
    expect(restore.status).toBe(200);

    const lessonBack = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}`,
      )
      .set('Cookie', student.cookie);
    expect(lessonBack.status).toBe(200);

    const listSubsBack = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/submissions`,
      )
      .set('Cookie', student.cookie);
    expect(listSubsBack.status).toBe(200);
    expect(listSubsBack.body.submissions).toHaveLength(1);
    expect(listSubsBack.body.submissions[0].id).toBe(submissionId);
  });

  it('soft-deleting a module blocks student access on LINEAR courses', async () => {
    const director = await seedDirector();
    const built = await buildPublishedCourse(director, {
      slug: 'soft-mod-linear',
      accessMode: 'LINEAR',
    });
    const student = await seedStudent(
      director,
      'soft-mod-linear@academia.test',
    );
    await request(fixture.app)
      .post(`/students/me/online-courses/${built.slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const before = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}`,
      )
      .set('Cookie', student.cookie);
    expect(before.status).toBe(200);

    await request(fixture.app)
      .patch(
        `/online-courses/${built.courseId}/modules/${built.moduleId}`,
      )
      .set('Cookie', director)
      .send({ isActive: false });

    const after = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}`,
      )
      .set('Cookie', student.cookie);
    expect(after.status).toBe(404);
  });

  it('admin quiz round-trip loads all questions; delete blocked after student attempt', async () => {
    const director = await seedDirector();
    const built = await buildPublishedCourse(director, {
      slug: 'quiz-admin-rich',
    });

    const create = await request(fixture.app)
      .put(`/online-courses/lessons/${built.lessonId}/quiz`)
      .set('Cookie', director)
      .send({
        title: 'Rich quiz',
        passScorePercent: 50,
        questions: [
          {
            prompt: 'Q1',
            type: 'SINGLE_CHOICE',
            options: [
              { label: 'A', isCorrect: true },
              { label: 'B', isCorrect: false },
            ],
          },
          {
            prompt: 'Q2',
            type: 'SINGLE_CHOICE',
            options: [
              { label: 'C', isCorrect: true },
              { label: 'D', isCorrect: false },
            ],
          },
        ],
      });
    expect(create.status).toBe(200);
    expect(create.body.quiz.questions).toHaveLength(2);
    expect(create.body.quiz.attemptCount).toBe(0);

    const loaded = await request(fixture.app)
      .get(`/online-courses/lessons/${built.lessonId}/quiz`)
      .set('Cookie', director);
    expect(loaded.status).toBe(200);
    expect(loaded.body.quiz.questions).toHaveLength(2);
    expect(loaded.body.quiz.questions[0].options[0].isCorrect).toBe(true);

    const q1 = loaded.body.quiz.questions[0];
    const q2 = loaded.body.quiz.questions[1];

    const student = await seedStudent(director, 'quiz-hist@academia.test');
    await request(fixture.app)
      .post(`/students/me/online-courses/${built.slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const submit = await request(fixture.app)
      .post(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/quiz/submit`,
      )
      .set('Cookie', student.cookie)
      .send({
        answers: [
          {
            questionId: q1.id,
            selectedOptionIds: [q1.options[0].id],
          },
          {
            questionId: q2.id,
            selectedOptionIds: [q2.options[0].id],
          },
        ],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.scorePercent).toBe(100);

    const deleteAttempt = await request(fixture.app)
      .put(`/online-courses/lessons/${built.lessonId}/quiz`)
      .set('Cookie', director)
      .send({
        title: 'Rich quiz',
        questions: [
          {
            id: q1.id,
            prompt: 'Q1 only',
            type: 'SINGLE_CHOICE',
            options: q1.options.map(
              (o: { id: string; label: string; isCorrect: boolean }) => ({
                id: o.id,
                label: o.label,
                isCorrect: o.isCorrect,
              }),
            ),
          },
        ],
      });
    expect(deleteAttempt.status).toBe(400);
    expect(deleteAttempt.body.error.message).toMatch(/eliminar preguntas/i);

    const preserve = await request(fixture.app)
      .put(`/online-courses/lessons/${built.lessonId}/quiz`)
      .set('Cookie', director)
      .send({
        title: 'Rich quiz edited',
        passScorePercent: 60,
        questions: [
          {
            id: q1.id,
            prompt: 'Q1 edited',
            type: 'SINGLE_CHOICE',
            options: [
              {
                id: q1.options[0].id,
                label: 'A',
                isCorrect: true,
              },
              {
                id: q1.options[1].id,
                label: 'B',
                isCorrect: false,
              },
            ],
          },
          {
            id: q2.id,
            prompt: 'Q2',
            type: 'SINGLE_CHOICE',
            options: [
              {
                id: q2.options[0].id,
                label: 'C',
                isCorrect: true,
              },
              {
                id: q2.options[1].id,
                label: 'D',
                isCorrect: false,
              },
            ],
          },
        ],
      });
    expect(preserve.status).toBe(200);
    expect(preserve.body.quiz.title).toBe('Rich quiz edited');
    expect(preserve.body.quiz.attemptCount).toBe(1);
    expect(preserve.body.quiz.questions[0].id).toBe(q1.id);
    expect(preserve.body.quiz.questions[0].prompt).toBe('Q1 edited');

    // Historical student score still readable via re-submit? We only assert
    // attemptCount and that student can still GET quiz with both questions.
    const publicQuiz = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}/quiz`,
      )
      .set('Cookie', student.cookie);
    expect(publicQuiz.status).toBe(200);
    expect(publicQuiz.body.quiz.questions).toHaveLength(2);
  });

  it('forbids ADMINISTRATIVE without online_courses.update from upserting quiz', async () => {
    const director = await seedDirector();
    const built = await buildPublishedCourse(director, {
      slug: 'quiz-perm',
    });
    fixture.users.seed({
      id: 'admin-quiz-1',
      email: 'admin-quiz@academia.test',
      name: 'ADMINISTRATIVE',
      role: 'ADMINISTRATIVE',
      isActive: true,
      passwordHash: await hashPassword('admin-password-12'),
    });
    const cookie = await loginAs(
      'admin-quiz@academia.test',
      'admin-password-12',
    );
    const upsert = await request(fixture.app)
      .put(`/online-courses/lessons/${built.lessonId}/quiz`)
      .set('Cookie', cookie!)
      .send({
        title: 'Nope',
        questions: [
          {
            prompt: 'X',
            type: 'SINGLE_CHOICE',
            options: [
              { label: 'A', isCorrect: true },
              { label: 'B', isCorrect: false },
            ],
          },
        ],
      });
    expect(upsert.status).toBe(403);
  });

  it('soft-deleting an individual lesson blocks access without deleting module', async () => {
    const director = await seedDirector();
    const built = await buildPublishedCourse(director, {
      slug: 'soft-lesson-only',
      accessMode: 'OPEN',
    });
    const student = await seedStudent(
      director,
      'soft-lesson-only@academia.test',
    );
    await request(fixture.app)
      .post(`/students/me/online-courses/${built.slug}/enroll-free`)
      .set('Cookie', student.cookie);

    const softLesson = await request(fixture.app)
      .patch(
        `/online-courses/${built.courseId}/modules/${built.moduleId}/lessons/${built.lessonId}`,
      )
      .set('Cookie', director)
      .send({ isActive: false });
    expect(softLesson.status).toBe(200);
    expect(softLesson.body.lesson.isActive).toBe(false);

    const modules = await request(fixture.app)
      .get(`/online-courses/${built.courseId}/modules`)
      .set('Cookie', director);
    expect(modules.status).toBe(200);
    expect(modules.body.modules[0].isActive).toBe(true);

    const lessonGet = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}`,
      )
      .set('Cookie', student.cookie);
    expect(lessonGet.status).toBe(404);

    // Restore lesson individually.
    const restoreLesson = await request(fixture.app)
      .patch(
        `/online-courses/${built.courseId}/modules/${built.moduleId}/lessons/${built.lessonId}`,
      )
      .set('Cookie', director)
      .send({ isActive: true });
    expect(restoreLesson.status).toBe(200);
    const lessonBack = await request(fixture.app)
      .get(
        `/students/me/online-courses/${built.slug}/lessons/${built.lessonId}`,
      )
      .set('Cookie', student.cookie);
    expect(lessonBack.status).toBe(200);
  });
});
