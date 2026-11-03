import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryOnlineCourseStore } from './in-memory-online-course-store.js';
import {
  createOnlineCourse,
  createOnlineCourseModule,
  createOnlineLesson,
  OnlineCourseValidationError,
} from './online-course-service.js';
import {
  assertQuizMutationSafeWithAttempts,
  getQuizAdmin,
  submitQuiz,
  upsertQuiz,
} from './online-quiz-service.js';
import { grantAccess } from './online-access-service.js';

describe('online quiz admin upsert (LMS-05)', () => {
  const store = createInMemoryOnlineCourseStore();

  beforeEach(() => {
    store.clear();
  });

  async function seedLesson() {
    const course = await createOnlineCourse(store, {
      title: 'Curso quiz',
      slug: `quiz-${randomUUID().slice(0, 8)}`,
      description: 'Desc',
      accessMode: 'OPEN',
    });
    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'M1',
    });
    const lesson = await createOnlineLesson(store, mod.id, {
      title: 'L1',
      status: 'PUBLISHED',
      acceptsSubmission: false,
    });
    return { course, lesson };
  }

  it('creates a multi-question quiz', async () => {
    const { lesson } = await seedLesson();
    const quiz = await upsertQuiz(store, lesson.id, {
      title: 'Check-in',
      passScorePercent: 50,
      questions: [
        {
          prompt: 'Capital?',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'Madrid', isCorrect: true },
            { label: 'Lisbon', isCorrect: false },
          ],
        },
        {
          prompt: '2+2?',
          type: 'SINGLE_CHOICE',
          points: 2,
          options: [
            { label: '4', isCorrect: true },
            { label: '5', isCorrect: false },
          ],
        },
      ],
    });
    expect(quiz.questions).toHaveLength(2);
    expect(quiz.attemptCount).toBe(0);
    expect(quiz.questions[1]?.points).toBe(2);
  });

  it('edits title, reorders, adds options and changes correct answer without attempts', async () => {
    const { lesson } = await seedLesson();
    const created = await upsertQuiz(store, lesson.id, {
      title: 'V1',
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

    const edited = await upsertQuiz(store, lesson.id, {
      title: 'V2',
      passScorePercent: 80,
      questions: [
        {
          prompt: 'Q2 edited',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'C', isCorrect: false },
            { label: 'D', isCorrect: true },
            { label: 'E', isCorrect: false },
          ],
        },
        {
          prompt: 'Q1 moved',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'A', isCorrect: true },
            { label: 'B', isCorrect: false },
          ],
        },
      ],
    });

    expect(edited.title).toBe('V2');
    expect(edited.passScorePercent).toBe(80);
    expect(edited.questions[0]?.prompt).toBe('Q2 edited');
    expect(edited.questions[0]?.options).toHaveLength(3);
    expect(
      edited.questions[0]?.options.find((o) => o.label === 'D')?.isCorrect,
    ).toBe(true);
    // replace mode regenerates ids when no attempts
    expect(edited.questions[0]?.id).not.toBe(created.questions[1]?.id);
  });

  it('deletes a question when there are no attempts', async () => {
    const { lesson } = await seedLesson();
    await upsertQuiz(store, lesson.id, {
      title: 'T',
      questions: [
        {
          prompt: 'Keep',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'A', isCorrect: true },
            { label: 'B', isCorrect: false },
          ],
        },
        {
          prompt: 'Drop',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'C', isCorrect: true },
            { label: 'D', isCorrect: false },
          ],
        },
      ],
    });
    const trimmed = await upsertQuiz(store, lesson.id, {
      title: 'T',
      questions: [
        {
          prompt: 'Keep',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'A', isCorrect: true },
            { label: 'B', isCorrect: false },
          ],
        },
      ],
    });
    expect(trimmed.questions).toHaveLength(1);
    expect(trimmed.questions[0]?.prompt).toBe('Keep');
  });

  it('preserves historical attempts and blocks question deletion after students submit', async () => {
    const { course, lesson } = await seedLesson();
    const quiz = await upsertQuiz(store, lesson.id, {
      title: 'Locked',
      passScorePercent: 50,
      questions: [
        {
          prompt: 'Q1',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'Yes', isCorrect: true },
            { label: 'No', isCorrect: false },
          ],
        },
        {
          prompt: 'Q2',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'A', isCorrect: true },
            { label: 'B', isCorrect: false },
          ],
        },
      ],
    });

    await grantAccess(store, {
      onlineCourseId: course.id,
      studentId: 'student-quiz-1',
      grantedByUserId: 'dir-1',
    });

    const q1 = quiz.questions[0]!;
    const opt = q1.options[0]!;
    const attempt = await submitQuiz(store, {
      lessonId: lesson.id,
      studentId: 'student-quiz-1',
      answers: [
        { questionId: q1.id, selectedOptionIds: [opt.id] },
        {
          questionId: quiz.questions[1]!.id,
          selectedOptionIds: [quiz.questions[1]!.options[0]!.id],
        },
      ],
    });
    expect(attempt.passed).toBe(true);
    expect(attempt.scorePercent).toBe(100);

    const beforeAttempts = await store.countQuizAttempts(quiz.id);
    expect(beforeAttempts).toBe(1);

    await expect(
      upsertQuiz(store, lesson.id, {
        title: 'Locked',
        questions: [
          {
            id: q1.id,
            prompt: 'Q1 kept',
            type: 'SINGLE_CHOICE',
            options: q1.options.map((o) => ({
              id: o.id,
              label: o.label,
              isCorrect: o.isCorrect,
            })),
          },
        ],
      }),
    ).rejects.toBeInstanceOf(OnlineCourseValidationError);

    const afterAttempts = await store.countQuizAttempts(quiz.id);
    expect(afterAttempts).toBe(1);
    const admin = await getQuizAdmin(store, lesson.id);
    expect(admin.questions).toHaveLength(2);
    expect(admin.attemptCount).toBe(1);
  });

  it('allows in-place edits and new questions when attempts exist', async () => {
    const { course, lesson } = await seedLesson();
    const quiz = await upsertQuiz(store, lesson.id, {
      title: 'Live',
      questions: [
        {
          prompt: 'Old',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'A', isCorrect: true },
            { label: 'B', isCorrect: false },
          ],
        },
      ],
    });
    await grantAccess(store, {
      onlineCourseId: course.id,
      studentId: 'student-quiz-2',
      grantedByUserId: 'dir-1',
    });
    const q = quiz.questions[0]!;
    await submitQuiz(store, {
      lessonId: lesson.id,
      studentId: 'student-quiz-2',
      answers: [
        {
          questionId: q.id,
          selectedOptionIds: [q.options[0]!.id],
        },
      ],
    });

    const updated = await upsertQuiz(store, lesson.id, {
      title: 'Live edited',
      passScorePercent: 60,
      questions: [
        {
          id: q.id,
          prompt: 'Old edited',
          type: 'SINGLE_CHOICE',
          points: 3,
          options: [
            {
              id: q.options[0]!.id,
              label: 'A renamed',
              isCorrect: false,
            },
            {
              id: q.options[1]!.id,
              label: 'B',
              isCorrect: true,
            },
          ],
        },
        {
          prompt: 'Brand new',
          type: 'SINGLE_CHOICE',
          options: [
            { label: 'X', isCorrect: true },
            { label: 'Y', isCorrect: false },
          ],
        },
      ],
    });

    expect(updated.title).toBe('Live edited');
    expect(updated.questions).toHaveLength(2);
    expect(updated.questions[0]?.id).toBe(q.id);
    expect(updated.questions[0]?.prompt).toBe('Old edited');
    expect(updated.questions[0]?.points).toBe(3);
    expect(updated.questions[0]?.options[0]?.id).toBe(q.options[0]!.id);
    expect(
      updated.questions[0]?.options.find((o) => o.label === 'B')?.isCorrect,
    ).toBe(true);
    expect(await store.countQuizAttempts(quiz.id)).toBe(1);
  });

  it('assertQuizMutationSafeWithAttempts rejects type changes', () => {
    const existing = {
      id: 'quiz-1',
      lessonId: 'lesson-1',
      title: 'T',
      passScorePercent: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      questions: [
        {
          id: 'q1',
          quizId: 'quiz-1',
          prompt: 'P',
          type: 'SINGLE_CHOICE' as const,
          position: 0,
          points: 1,
          correctText: null,
          explanation: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          options: [
            {
              id: 'o1',
              questionId: 'q1',
              label: 'A',
              position: 0,
              isCorrect: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'o2',
              questionId: 'q1',
              label: 'B',
              position: 1,
              isCorrect: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ],
    };

    expect(() =>
      assertQuizMutationSafeWithAttempts(existing, [
        {
          id: 'q1',
          prompt: 'P',
          type: 'SHORT_TEXT',
          points: 1,
          correctText: 'x',
          explanation: null,
          options: [],
        },
      ]),
    ).toThrow(OnlineCourseValidationError);
  });
});
