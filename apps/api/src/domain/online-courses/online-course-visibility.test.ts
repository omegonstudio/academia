import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryOnlineCourseStore } from './in-memory-online-course-store.js';
import {
  createOnlineCourse,
  createOnlineCourseModule,
  createOnlineLesson,
  createOnlineLessonAsset,
  OnlineCourseNotFoundError,
  publishOnlineCourse,
  updateOnlineCourseModule,
  updateOnlineLesson,
} from './online-course-service.js';
import { requireActiveLessonInActiveModule } from './online-course-visibility.js';
import { startLesson, completeLesson } from './online-progress-service.js';
import { grantAccess } from './online-access-service.js';
import { createSubmission } from './online-submission-service.js';
import { upsertQuiz, submitQuiz } from './online-quiz-service.js';

describe('online course module/lesson visibility (LMS-04)', () => {
  const store = createInMemoryOnlineCourseStore();

  beforeEach(() => {
    store.clear();
  });

  async function seedPublished(options?: {
    accessMode?: 'OPEN' | 'LINEAR';
    acceptsSubmission?: boolean;
    withQuiz?: boolean;
  }) {
    const course = await createOnlineCourse(store, {
      title: 'Curso integridad',
      slug: `int-${randomUUID().slice(0, 8)}`,
      description: 'Descripción válida.',
      accessMode: options?.accessMode ?? 'OPEN',
    });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Módulo 1',
    });
    const lesson = await createOnlineLesson(store, mod.id, {
      title: 'Lección 1',
      status: 'PUBLISHED',
      isRequired: true,
      acceptsSubmission: options?.acceptsSubmission ?? false,
    });
    await createOnlineLessonAsset(store, lesson.id, 'user-1', {
      kind: 'TEXT',
      title: 'Texto',
      bodyText: 'Contenido',
    });
    if (options?.withQuiz) {
      await upsertQuiz(store, lesson.id, {
        title: 'Q',
        questions: [
          {
            prompt: '¿1?',
            type: 'SINGLE_CHOICE',
            options: [
              { label: 'a', isCorrect: true },
              { label: 'b', isCorrect: false },
            ],
          },
        ],
      });
    }
    await publishOnlineCourse(store, course.id);
    return { course, mod, lesson };
  }

  it('rejects student navigation when parent module is soft-deleted', async () => {
    const { mod, lesson } = await seedPublished();
    await updateOnlineCourseModule(store, mod.id, { isActive: false });

    // Lessons keep their own isActive (no cascade write).
    const lessonRow = await store.findLessonById(lesson.id);
    expect(lessonRow?.isActive).toBe(true);

    await expect(
      requireActiveLessonInActiveModule(store, lesson.id),
    ).rejects.toBeInstanceOf(OnlineCourseNotFoundError);

    const ordered = await store.listLessonOrderRefs(
      (await store.findModuleById(mod.id))!.onlineCourseId,
    );
    expect(ordered.find((r) => r.id === lesson.id)).toBeUndefined();
  });

  it('rejects student navigation when lesson is soft-deleted individually', async () => {
    const { lesson } = await seedPublished();
    await updateOnlineLesson(store, lesson.id, { isActive: false });
    await expect(
      requireActiveLessonInActiveModule(store, lesson.id),
    ).rejects.toBeInstanceOf(OnlineCourseNotFoundError);
  });

  it('restoring a module re-exposes still-active lessons; not individually deleted ones', async () => {
    const { course, mod, lesson } = await seedPublished();
    const lesson2 = await createOnlineLesson(store, mod.id, {
      title: 'Lección 2',
      status: 'PUBLISHED',
      acceptsSubmission: true,
    });
    await createOnlineLessonAsset(store, lesson2.id, 'user-1', {
      kind: 'TEXT',
      title: 'T2',
      bodyText: 'Más',
    });

    await updateOnlineLesson(store, lesson2.id, { isActive: false });
    await updateOnlineCourseModule(store, mod.id, { isActive: false });

    await updateOnlineCourseModule(store, mod.id, { isActive: true });

    await expect(
      requireActiveLessonInActiveModule(store, lesson.id),
    ).resolves.toMatchObject({ lesson: { id: lesson.id } });
    await expect(
      requireActiveLessonInActiveModule(store, lesson2.id),
    ).rejects.toBeInstanceOf(OnlineCourseNotFoundError);

    // Course id still resolves for historical refs.
    expect(await store.findCourseIdForLesson(lesson2.id)).toBe(course.id);
  });

  it('keeps progress and submissions after module soft-delete (OPEN)', async () => {
    const { course, mod, lesson } = await seedPublished({
      accessMode: 'OPEN',
      acceptsSubmission: true,
    });
    await grantAccess(store, {
      onlineCourseId: course.id,
      studentId: 'student-1',
      grantedByUserId: 'dir-1',
    });

    const progress = await startLesson(store, {
      studentId: 'student-1',
      lessonId: lesson.id,
    });
    expect(progress?.status).toBe('IN_PROGRESS');
    await completeLesson(store, {
      studentId: 'student-1',
      lessonId: lesson.id,
    });
    const submission = await createSubmission(store, {
      lessonId: lesson.id,
      studentId: 'student-1',
      body: { bodyText: 'entrega histórica' },
    });
    expect(submission?.bodyText).toBe('entrega histórica');

    await updateOnlineCourseModule(store, mod.id, { isActive: false });

    // New mutations blocked.
    await expect(
      startLesson(store, { studentId: 'student-1', lessonId: lesson.id }),
    ).rejects.toBeInstanceOf(OnlineCourseNotFoundError);
    await expect(
      createSubmission(store, {
        lessonId: lesson.id,
        studentId: 'student-1',
        body: { bodyText: 'nueva' },
      }),
    ).rejects.toBeInstanceOf(OnlineCourseNotFoundError);

    // Historical rows intact.
    const keptProgress = await store.findProgress(lesson.id, 'student-1');
    expect(keptProgress?.status).toBe('COMPLETED');
    const keptSubs = await store.listSubmissionsByLessonAndStudent(
      lesson.id,
      'student-1',
    );
    expect(keptSubs).toHaveLength(1);
    expect(keptSubs[0]?.bodyText).toBe('entrega histórica');
  });

  it('blocks quiz submit after module soft-delete (LINEAR)', async () => {
    const { course, mod, lesson } = await seedPublished({
      accessMode: 'LINEAR',
      withQuiz: true,
    });
    await grantAccess(store, {
      onlineCourseId: course.id,
      studentId: 'student-2',
      grantedByUserId: 'dir-1',
    });

    const quiz = await store.findQuizByLessonId(lesson.id);
    const question = quiz!.questions[0]!;
    const option = question.options[0]!;

    const ok = await submitQuiz(store, {
      lessonId: lesson.id,
      studentId: 'student-2',
      answers: [
        { questionId: question.id, selectedOptionIds: [option.id] },
      ],
    });
    expect(ok.passed).toBe(true);

    await updateOnlineCourseModule(store, mod.id, { isActive: false });

    await expect(
      submitQuiz(store, {
        lessonId: lesson.id,
        studentId: 'student-2',
        answers: [
          { questionId: question.id, selectedOptionIds: [option.id] },
        ],
      }),
    ).rejects.toBeInstanceOf(OnlineCourseNotFoundError);

    const attempts = [...store.attempts.values()].filter(
      (a) => a.quizId === quiz!.id && a.studentId === 'student-2',
    );
    expect(attempts.length).toBeGreaterThanOrEqual(1);
  });
});
