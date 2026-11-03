import {
  OnlineCourseNotFoundError,
  type OnlineCourseModuleRecord,
  type OnlineCourseStore,
  type OnlineLessonRecord,
} from './online-course-service.js';

/**
 * LMS-04 visibility policy (no schema change):
 * - Soft-delete = `isActive: false` on module or lesson (never hard-delete).
 * - Soft-deleting a module does **not** cascade-write lesson rows; lessons keep
 *   their own `isActive` for individual history / restore independence.
 * - Student-facing content requires **both** module and lesson active.
 * - Progress, quiz attempts and submissions rows are never deleted by soft-delete.
 * - Restoring a module (`isActive: true`) re-exposes lessons that remained active;
 *   individually deactivated lessons stay inactive.
 */
export async function requireActiveLessonInActiveModule(
  store: OnlineCourseStore,
  lessonId: string,
): Promise<{
  lesson: OnlineLessonRecord;
  module: OnlineCourseModuleRecord;
}> {
  const lesson = await store.findLessonById(lessonId);
  if (!lesson || !lesson.isActive) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }
  const module = await store.findModuleById(lesson.moduleId);
  if (!module || !module.isActive) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }
  return { lesson, module };
}
