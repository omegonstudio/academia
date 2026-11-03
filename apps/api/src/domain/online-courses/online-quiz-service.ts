import type {
  OnlineQuizAdmin,
  OnlineQuizAttemptResult,
  OnlineQuizPublic,
  SubmitOnlineQuizRequest,
  UpsertOnlineQuizRequest,
} from '@academia/shared';
import { hasActiveAccess } from './online-access-service.js';
import {
  OnlineCourseForbiddenError,
  OnlineCourseNotFoundError,
  OnlineCourseValidationError,
  toOnlineQuizAdminDto,
  toOnlineQuizPublicDto,
  type OnlineCourseStore,
  type OnlineQuizQuestionInput,
  type OnlineQuizQuestionRecord,
  type OnlineQuizRecord,
} from './online-course-service.js';
import { requireActiveLessonInActiveModule } from './online-course-visibility.js';

function validateQuizQuestions(
  questions: UpsertOnlineQuizRequest['questions'],
): OnlineQuizQuestionInput[] {
  return questions.map((q, index) => {
    const options = q.options ?? [];
    if (q.type === 'SHORT_TEXT') {
      if (!q.correctText || q.correctText.trim().length === 0) {
        throw new OnlineCourseValidationError(
          `Question ${index + 1}: correctText is required for SHORT_TEXT.`,
        );
      }
      if (options.length > 0) {
        throw new OnlineCourseValidationError(
          `Question ${index + 1}: SHORT_TEXT must not include options.`,
        );
      }
      return {
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        points: q.points ?? 1,
        correctText: q.correctText.trim(),
        explanation: q.explanation ?? null,
        options: [],
      };
    }

    if (options.length < 2) {
      throw new OnlineCourseValidationError(
        `Question ${index + 1}: at least two options are required.`,
      );
    }

    const correctCount = options.filter((o) => o.isCorrect).length;
    if (q.type === 'MULTIPLE_CHOICE') {
      if (correctCount < 1) {
        throw new OnlineCourseValidationError(
          `Question ${index + 1}: MULTIPLE_CHOICE needs at least one correct option.`,
        );
      }
    } else if (correctCount !== 1) {
      throw new OnlineCourseValidationError(
        `Question ${index + 1}: exactly one correct option is required.`,
      );
    }

    return {
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      points: q.points ?? 1,
      correctText: null,
      explanation: q.explanation ?? null,
      options: options.map((o) => ({
        id: o.id,
        label: o.label,
        isCorrect: o.isCorrect,
      })),
    };
  });
}

/**
 * When student attempts exist, structural deletes and type changes are blocked.
 * Historical OnlineQuizAttempt rows (score + answersJson) are never deleted.
 */
export function assertQuizMutationSafeWithAttempts(
  existing: OnlineQuizRecord,
  incoming: OnlineQuizQuestionInput[],
): void {
  const byId = new Map(existing.questions.map((q) => [q.id, q] as const));
  const incomingExistingIds = new Set(
    incoming.map((q) => q.id).filter((id): id is string => Boolean(id)),
  );

  for (const question of existing.questions) {
    if (!incomingExistingIds.has(question.id)) {
      throw new OnlineCourseValidationError(
        'No se pueden eliminar preguntas de un cuestionario con intentos de alumnos.',
      );
    }
  }

  for (const q of incoming) {
    if (!q.id) continue;
    const prev = byId.get(q.id);
    if (!prev) {
      throw new OnlineCourseValidationError(
        'Una pregunta enviada no pertenece a este cuestionario.',
      );
    }
    if (prev.type !== q.type) {
      throw new OnlineCourseValidationError(
        'No se puede cambiar el tipo de una pregunta con intentos de alumnos.',
      );
    }
    const incomingOptionIds = new Set(
      q.options.map((o) => o.id).filter((id): id is string => Boolean(id)),
    );
    for (const option of prev.options) {
      if (!incomingOptionIds.has(option.id)) {
        throw new OnlineCourseValidationError(
          'No se pueden eliminar opciones de una pregunta con intentos de alumnos.',
        );
      }
    }
    for (const option of q.options) {
      if (option.id && !prev.options.some((o) => o.id === option.id)) {
        throw new OnlineCourseValidationError(
          'Una opción enviada no pertenece a esta pregunta.',
        );
      }
    }
  }
}

export async function upsertQuiz(
  store: OnlineCourseStore,
  lessonId: string,
  input: UpsertOnlineQuizRequest,
): Promise<OnlineQuizAdmin> {
  const lesson = await store.findLessonById(lessonId);
  if (!lesson || !lesson.isActive) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }

  const questions = validateQuizQuestions(input.questions);
  const existing = await store.findQuizByLessonId(lessonId);
  let mode: 'replace' | 'preserve' = 'replace';

  if (existing) {
    const attemptCount = await store.countQuizAttempts(existing.id);
    if (attemptCount > 0) {
      assertQuizMutationSafeWithAttempts(existing, questions);
      mode = 'preserve';
    }
  }

  const record = await store.upsertQuiz({
    lessonId,
    title: input.title,
    passScorePercent:
      input.passScorePercent === undefined ? null : input.passScorePercent,
    questions,
    mode,
  });
  const attemptCount = await store.countQuizAttempts(record.id);
  return toOnlineQuizAdminDto(record, attemptCount);
}

export async function getQuizAdmin(
  store: OnlineCourseStore,
  lessonId: string,
): Promise<OnlineQuizAdmin> {
  const quiz = await store.findQuizByLessonId(lessonId);
  if (!quiz || !quiz.isActive) {
    throw new OnlineCourseNotFoundError('Quiz not found.');
  }
  const attemptCount = await store.countQuizAttempts(quiz.id);
  return toOnlineQuizAdminDto(quiz, attemptCount);
}

/** Public quiz payload — strips isCorrect and correctText. */
export async function getQuizPublic(
  store: OnlineCourseStore,
  lessonId: string,
): Promise<OnlineQuizPublic> {
  const quiz = await store.findQuizByLessonId(lessonId);
  if (!quiz || !quiz.isActive) {
    throw new OnlineCourseNotFoundError('Quiz not found.');
  }
  return toOnlineQuizPublicDto(quiz);
}

function normalizeShortText(value: string): string {
  return value.trim().toLowerCase();
}

function evaluateQuestion(
  question: OnlineQuizQuestionRecord,
  answer:
    | {
        questionId: string;
        selectedOptionIds?: string[];
        textAnswer?: string;
      }
    | undefined,
): { correct: boolean; pointsAwarded: number } {
  if (question.type === 'SHORT_TEXT') {
    const expected = question.correctText
      ? normalizeShortText(question.correctText)
      : '';
    const given = answer?.textAnswer
      ? normalizeShortText(answer.textAnswer)
      : '';
    const correct = expected.length > 0 && given === expected;
    return {
      correct,
      pointsAwarded: correct ? question.points : 0,
    };
  }

  const selected = new Set(answer?.selectedOptionIds ?? []);
  const correctIds = new Set(
    question.options.filter((o) => o.isCorrect).map((o) => o.id),
  );

  if (question.type === 'MULTIPLE_CHOICE') {
    const correct =
      selected.size === correctIds.size &&
      [...correctIds].every((id) => selected.has(id));
    return {
      correct,
      pointsAwarded: correct ? question.points : 0,
    };
  }

  // SINGLE_CHOICE / TRUE_FALSE — exactly one correct option.
  const correct =
    selected.size === 1 &&
    correctIds.size === 1 &&
    selected.has([...correctIds][0]!);
  return {
    correct,
    pointsAwarded: correct ? question.points : 0,
  };
}

export function evaluateQuizAttempt(
  quiz: OnlineQuizRecord,
  answers: SubmitOnlineQuizRequest['answers'],
): OnlineQuizAttemptResult {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a] as const));
  let pointsAwardedTotal = 0;
  let pointsPossibleTotal = 0;

  const results = quiz.questions.map((question) => {
    pointsPossibleTotal += question.points;
    const evaluation = evaluateQuestion(
      question,
      byQuestion.get(question.id),
    );
    pointsAwardedTotal += evaluation.pointsAwarded;
    return {
      questionId: question.id,
      correct: evaluation.correct,
      explanation: question.explanation,
      pointsAwarded: evaluation.pointsAwarded,
      pointsPossible: question.points,
    };
  });

  const scorePercent =
    pointsPossibleTotal === 0
      ? 0
      : Math.round((pointsAwardedTotal / pointsPossibleTotal) * 100);

  const passed =
    quiz.passScorePercent === null || scorePercent >= quiz.passScorePercent;

  return { scorePercent, passed, results };
}

export async function submitQuiz(
  store: OnlineCourseStore,
  input: {
    lessonId: string;
    studentId: string;
    answers: SubmitOnlineQuizRequest['answers'];
    preview?: boolean;
  },
): Promise<OnlineQuizAttemptResult> {
  await requireActiveLessonInActiveModule(store, input.lessonId);

  const quiz = await store.findQuizByLessonId(input.lessonId);
  if (!quiz || !quiz.isActive) {
    throw new OnlineCourseNotFoundError('Quiz not found.');
  }

  const onlineCourseId = await store.findCourseIdForLesson(input.lessonId);
  if (!onlineCourseId) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }

  const preview = input.preview === true;
  if (!preview) {
    const allowed = await hasActiveAccess(
      store,
      input.studentId,
      onlineCourseId,
    );
    if (!allowed) {
      throw new OnlineCourseForbiddenError(
        'You do not have access to this online course.',
      );
    }
  }

  const result = evaluateQuizAttempt(quiz, input.answers);

  if (!preview) {
    await store.createQuizAttempt({
      quizId: quiz.id,
      studentId: input.studentId,
      scorePercent: result.scorePercent,
      passed: result.passed,
      answersJson: {
        answers: input.answers,
        results: result.results,
      },
    });
  }

  return result;
}
