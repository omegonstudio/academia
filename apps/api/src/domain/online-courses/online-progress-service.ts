import type { OnlineLessonProgress } from '@academia/shared';
import { hasActiveAccess } from './online-access-service.js';
import {
  OnlineCourseForbiddenError,
  OnlineCourseNotFoundError,
  OnlineCourseValidationError,
  toOnlineLessonProgressDto,
  type OnlineCourseStore,
  type OnlineLessonOrderRef,
  type OnlineLessonProgressRecord,
} from './online-course-service.js';

function requiredPublishedActive(
  refs: OnlineLessonOrderRef[],
): OnlineLessonOrderRef[] {
  return refs.filter(
    (r) => r.isActive && r.status === 'PUBLISHED' && r.isRequired,
  );
}

function sortLessonRefs(refs: OnlineLessonOrderRef[]): OnlineLessonOrderRef[] {
  return [...refs].sort((a, b) => {
    if (a.modulePosition !== b.modulePosition) {
      return a.modulePosition - b.modulePosition;
    }
    return a.position - b.position;
  });
}

/**
 * Whether `lessonId` is locked under LINEAR given full ordered lesson refs
 * (active only) and progress map. Non-required lessons are still locked
 * until all prior required published lessons are complete. OPEN: never locked.
 */
export function isLessonLockedInCourse(
  accessMode: 'OPEN' | 'LINEAR',
  lessonId: string,
  allOrdered: OnlineLessonOrderRef[],
  progressByLessonId: Map<string, OnlineLessonProgressRecord>,
): boolean {
  if (accessMode === 'OPEN') return false;

  const ordered = sortLessonRefs(allOrdered).filter((r) => r.isActive);
  const target = ordered.find((r) => r.id === lessonId);
  if (!target) return true;

  for (const ref of ordered) {
    if (ref.id === lessonId) return false;
    if (!(ref.isRequired && ref.status === 'PUBLISHED')) continue;
    const progress = progressByLessonId.get(ref.id);
    if (!progress || progress.status !== 'COMPLETED') {
      return true;
    }
  }
  return false;
}

export function calculateProgressPercent(
  orderedRefs: OnlineLessonOrderRef[],
  progressByLessonId: Map<string, OnlineLessonProgressRecord>,
): {
  progressPercent: number;
  completedRequiredLessons: number;
  requiredLessons: number;
} {
  const required = requiredPublishedActive(sortLessonRefs(orderedRefs));
  const requiredLessons = required.length;
  if (requiredLessons === 0) {
    return {
      progressPercent: 0,
      completedRequiredLessons: 0,
      requiredLessons: 0,
    };
  }

  let completedRequiredLessons = 0;
  for (const ref of required) {
    const progress = progressByLessonId.get(ref.id);
    if (progress?.status === 'COMPLETED') {
      completedRequiredLessons += 1;
    }
  }

  const progressPercent = Math.round(
    (completedRequiredLessons / requiredLessons) * 100,
  );
  return { progressPercent, completedRequiredLessons, requiredLessons };
}

async function assertCanMutateProgress(
  store: OnlineCourseStore,
  studentId: string,
  lessonId: string,
  preview: boolean,
): Promise<void> {
  const onlineCourseId = await store.findCourseIdForLesson(lessonId);
  if (!onlineCourseId) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }

  const course = await store.findById(onlineCourseId);
  if (!course || !course.isActive) {
    throw new OnlineCourseNotFoundError();
  }

  if (!preview) {
    const allowed = await hasActiveAccess(store, studentId, onlineCourseId);
    if (!allowed) {
      throw new OnlineCourseForbiddenError(
        'You do not have access to this online course.',
      );
    }
  }

  const ordered = await store.listLessonOrderRefs(onlineCourseId);
  const lesson = ordered.find((r) => r.id === lessonId && r.isActive);
  if (!lesson) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }
  if (lesson.status !== 'PUBLISHED' && !preview) {
    throw new OnlineCourseValidationError('Lesson is not published.');
  }

  if (!preview) {
    const progressRows = await store.listProgressForStudentInCourse(
      studentId,
      onlineCourseId,
    );
    const progressByLessonId = new Map(
      progressRows.map((p) => [p.lessonId, p] as const),
    );
    if (
      isLessonLockedInCourse(
        course.accessMode,
        lessonId,
        ordered,
        progressByLessonId,
      )
    ) {
      throw new OnlineCourseForbiddenError(
        'Complete previous required lessons before continuing.',
      );
    }
  }
}

export async function startLesson(
  store: OnlineCourseStore,
  input: {
    studentId: string;
    lessonId: string;
    /** Director preview: skip access check and do not write progress. */
    preview?: boolean;
  },
): Promise<OnlineLessonProgress | null> {
  const preview = input.preview === true;
  await assertCanMutateProgress(
    store,
    input.studentId,
    input.lessonId,
    preview,
  );

  if (preview) {
    return null;
  }

  const existing = await store.findProgress(input.lessonId, input.studentId);
  if (existing?.status === 'COMPLETED') {
    return toOnlineLessonProgressDto(existing);
  }
  if (existing?.status === 'IN_PROGRESS') {
    return toOnlineLessonProgressDto(existing);
  }

  const now = new Date();
  const record = await store.upsertProgress({
    lessonId: input.lessonId,
    studentId: input.studentId,
    status: 'IN_PROGRESS',
    startedAt: existing?.startedAt ?? now,
    completedAt: null,
    scorePercent: existing?.scorePercent ?? null,
  });
  return toOnlineLessonProgressDto(record);
}

export async function completeLesson(
  store: OnlineCourseStore,
  input: {
    studentId: string;
    lessonId: string;
    scorePercent?: number | null;
    preview?: boolean;
  },
): Promise<OnlineLessonProgress | null> {
  const preview = input.preview === true;
  await assertCanMutateProgress(
    store,
    input.studentId,
    input.lessonId,
    preview,
  );

  if (preview) {
    return null;
  }

  const existing = await store.findProgress(input.lessonId, input.studentId);
  const now = new Date();
  const record = await store.upsertProgress({
    lessonId: input.lessonId,
    studentId: input.studentId,
    status: 'COMPLETED',
    startedAt: existing?.startedAt ?? now,
    completedAt: existing?.completedAt ?? now,
    scorePercent:
      input.scorePercent !== undefined
        ? input.scorePercent
        : (existing?.scorePercent ?? null),
  });
  return toOnlineLessonProgressDto(record);
}

export async function getProgressMapForCourse(
  store: OnlineCourseStore,
  studentId: string,
  onlineCourseId: string,
): Promise<Map<string, OnlineLessonProgressRecord>> {
  const rows = await store.listProgressForStudentInCourse(
    studentId,
    onlineCourseId,
  );
  return new Map(rows.map((p) => [p.lessonId, p] as const));
}
