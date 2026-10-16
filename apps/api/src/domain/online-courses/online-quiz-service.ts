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
      prompt: q.prompt,
      type: q.type,
      points: q.points ?? 1,
      correctText: null,
      explanation: q.explanation ?? null,
      options: options.map((o) => ({
        label: o.label,
        isCorrect: o.isCorrect,
      })),
    };
  });
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
  const record = await store.upsertQuiz({
    lessonId,
    title: input.title,
    passScorePercent:
      input.passScorePercent === undefined ? null : input.passScorePercent,
    questions,
  });
  return toOnlineQuizAdminDto(record);
}

export async function getQuizAdmin(
  store: OnlineCourseStore,
  lessonId: string,
): Promise<OnlineQuizAdmin> {
  const quiz = await store.findQuizByLessonId(lessonId);
  if (!quiz || !quiz.isActive) {
    throw new OnlineCourseNotFoundError('Quiz not found.');
  }
  return toOnlineQuizAdminDto(quiz);
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
  const pointsPossible = question.points;

  if (question.type === 'SHORT_TEXT') {
    const expected = question.correctText ?? '';
    const given = answer?.textAnswer ?? '';
    const correct =
      normalizeShortText(given) === normalizeShortText(expected) &&
      expected.trim().length > 0;
    return {
      correct,
      pointsAwarded: correct ? pointsPossible : 0,
    };
  }

  const selected = new Set(answer?.selectedOptionIds ?? []);
  const correctIds = new Set(
    question.options.filter((o) => o.isCorrect).map((o) => o.id),
  );

  if (question.type === 'MULTIPLE_CHOICE') {
    if (selected.size !== correctIds.size) {
      return { correct: false, pointsAwarded: 0 };
    }
    for (const id of correctIds) {
      if (!selected.has(id)) {
        return { correct: false, pointsAwarded: 0 };
      }
    }
    return { correct: true, pointsAwarded: pointsPossible };
  }

  // SINGLE_CHOICE / TRUE_FALSE
  if (selected.size !== 1) {
    return { correct: false, pointsAwarded: 0 };
  }
  const only = [...selected][0]!;
  const correct = correctIds.has(only);
  return {
    correct,
    pointsAwarded: correct ? pointsPossible : 0,
  };
}

export function evaluateQuizAttempt(
  quiz: OnlineQuizRecord,
  answers: SubmitOnlineQuizRequest['answers'],
): OnlineQuizAttemptResult {
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
  let pointsAwardedTotal = 0;
  let pointsPossibleTotal = 0;

  const results = quiz.questions.map((question) => {
    const evaluation = evaluateQuestion(
      question,
      answerByQuestion.get(question.id),
    );
    pointsAwardedTotal += evaluation.pointsAwarded;
    pointsPossibleTotal += question.points;
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
