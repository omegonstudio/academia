import type {
  OnlineCourseStore,
  OnlineLessonAssetRecord,
  OnlineLessonRecord,
  OnlineQuizRecord,
} from './online-course-service.js';
import { OnlineCourseValidationError } from './online-course-service.js';

export type OnlineCoursePublishIssueCode =
  | 'TITLE_REQUIRED'
  | 'DESCRIPTION_REQUIRED'
  | 'MODULES_REQUIRED'
  | 'PUBLISHABLE_LESSON_REQUIRED'
  | 'LESSON_CONTENT_REQUIRED'
  | 'ASSET_INVALID';

export type OnlineCoursePublishIssue = {
  code: OnlineCoursePublishIssueCode;
  message: string;
  lessonId?: string;
  assetId?: string;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Active asset has usable content for its kind (no new schema fields). */
export function isOnlineLessonAssetPublishable(
  asset: OnlineLessonAssetRecord,
): boolean {
  if (!asset.isActive) return false;
  switch (asset.kind) {
    case 'TEXT':
      return hasText(asset.bodyText);
    case 'LINK':
    case 'VIDEO':
      return hasText(asset.externalUrl);
    case 'DOCUMENT':
      return (
        asset.uploadStatus === 'READY' &&
        hasText(asset.storageKey)
      );
    default:
      return false;
  }
}

function quizIsTeachable(quiz: OnlineQuizRecord | null): boolean {
  return Boolean(
    quiz &&
      quiz.isActive &&
      quiz.questions.length > 0,
  );
}

/**
 * A published lesson is teachable if it has at least one valid teaching
 * mechanism already supported by the model: content asset, quiz, or submission.
 */
export function lessonHasTeachableContent(input: {
  lesson: OnlineLessonRecord;
  assets: OnlineLessonAssetRecord[];
  quiz: OnlineQuizRecord | null;
}): boolean {
  if (input.lesson.acceptsSubmission) return true;
  if (quizIsTeachable(input.quiz)) return true;
  return input.assets.some(isOnlineLessonAssetPublishable);
}

export type OnlineCoursePublishFieldOverrides = {
  title?: string;
  description?: string | null;
};

/**
 * Evaluate publish readiness without mutating state.
 * OPEN and LINEAR share the same structural rules; accessMode is irrelevant here.
 * Optional field overrides let PATCH { status, description } validate the merged view.
 */
export async function evaluateOnlineCoursePublishReadiness(
  store: OnlineCourseStore,
  courseId: string,
  overrides?: OnlineCoursePublishFieldOverrides,
): Promise<OnlineCoursePublishIssue[]> {
  const course = await store.findById(courseId);
  if (!course) {
    // Caller should have required the course; keep a clear domain message.
    throw new OnlineCourseValidationError('Online course not found.');
  }

  const title =
    overrides?.title !== undefined ? overrides.title : course.title;
  const description =
    overrides?.description !== undefined
      ? overrides.description
      : course.description;

  const issues: OnlineCoursePublishIssue[] = [];

  if (!hasText(title)) {
    issues.push({
      code: 'TITLE_REQUIRED',
      message: 'El curso necesita un título válido.',
    });
  }

  if (!hasText(description)) {
    issues.push({
      code: 'DESCRIPTION_REQUIRED',
      message: 'El curso necesita una descripción válida.',
    });
  }

  const modules = await store.listModules(courseId, {
    includeInactive: false,
  });
  if (modules.length === 0) {
    issues.push({
      code: 'MODULES_REQUIRED',
      message: 'El curso necesita al menos un módulo.',
    });
    return issues;
  }

  const publishedLessons: OnlineLessonRecord[] = [];
  for (const mod of modules) {
    const lessons = await store.listLessons(mod.id, {
      includeInactive: false,
    });
    for (const lesson of lessons) {
      if (lesson.status === 'PUBLISHED') {
        publishedLessons.push(lesson);
      }
    }
  }

  if (publishedLessons.length === 0) {
    issues.push({
      code: 'PUBLISHABLE_LESSON_REQUIRED',
      message: 'Agregá una lección publicada antes de publicar el curso.',
    });
    return issues;
  }

  for (const lesson of publishedLessons) {
    const assets = await store.listAssets(lesson.id, {
      includeInactive: false,
    });
    const quiz = await store.findQuizByLessonId(lesson.id);

    for (const asset of assets) {
      if (!isOnlineLessonAssetPublishable(asset)) {
        issues.push({
          code: 'ASSET_INVALID',
          message: `Un recurso asociado no está disponible («${asset.title}» en «${lesson.title}»).`,
          lessonId: lesson.id,
          assetId: asset.id,
        });
      }
    }

    if (
      !lessonHasTeachableContent({
        lesson,
        assets,
        quiz,
      })
    ) {
      issues.push({
        code: 'LESSON_CONTENT_REQUIRED',
        message: `Una lección publicada no tiene contenido («${lesson.title}»).`,
        lessonId: lesson.id,
      });
    }
  }

  return issues;
}

export async function assertOnlineCourseReadyToPublish(
  store: OnlineCourseStore,
  courseId: string,
  overrides?: OnlineCoursePublishFieldOverrides,
): Promise<void> {
  const issues = await evaluateOnlineCoursePublishReadiness(
    store,
    courseId,
    overrides,
  );
  if (issues.length === 0) return;
  throw new OnlineCourseValidationError(
    issues.map((issue) => issue.message).join('\n'),
  );
}
