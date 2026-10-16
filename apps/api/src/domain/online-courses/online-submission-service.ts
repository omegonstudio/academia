import type {
  CreateOnlineLessonSubmissionRequest,
  OnlineLessonSubmission,
} from '@academia/shared';
import { hasActiveAccess } from './online-access-service.js';
import {
  OnlineCourseForbiddenError,
  OnlineCourseNotFoundError,
  OnlineCourseValidationError,
  sanitizeOnlineLessonBodyText,
  toOnlineLessonSubmissionDto,
  type OnlineCourseStore,
} from './online-course-service.js';

export async function createSubmission(
  store: OnlineCourseStore,
  input: {
    lessonId: string;
    studentId: string;
    body: CreateOnlineLessonSubmissionRequest;
    preview?: boolean;
  },
): Promise<OnlineLessonSubmission | null> {
  const lesson = await store.findLessonById(input.lessonId);
  if (!lesson || !lesson.isActive) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }
  if (!lesson.acceptsSubmission) {
    throw new OnlineCourseValidationError(
      'This lesson does not accept submissions.',
    );
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

  const rawText = input.body.bodyText?.trim() ?? '';
  if (!rawText) {
    throw new OnlineCourseValidationError(
      'bodyText is required for text submissions.',
    );
  }

  const bodyText = sanitizeOnlineLessonBodyText(rawText);

  if (preview) {
    return null;
  }

  const record = await store.createSubmission({
    lessonId: input.lessonId,
    studentId: input.studentId,
    bodyText,
  });
  return toOnlineLessonSubmissionDto(record);
}

export async function listOwnSubmissions(
  store: OnlineCourseStore,
  lessonId: string,
  studentId: string,
): Promise<OnlineLessonSubmission[]> {
  const lesson = await store.findLessonById(lessonId);
  if (!lesson || !lesson.isActive) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }

  const rows = await store.listSubmissionsByLessonAndStudent(
    lessonId,
    studentId,
  );
  return rows.map(toOnlineLessonSubmissionDto);
}
