import { isOnlineCourseFree } from '@academia/shared';
import {
  OnlineCourseConflictError,
  OnlineCourseForbiddenError,
  OnlineCourseNotFoundError,
  OnlineCourseValidationError,
  toOnlineCourseAccessDto,
  type OnlineCourseAccessRecord,
  type OnlineCourseStore,
} from './online-course-service.js';
import type { OnlineCourseAccess } from '@academia/shared';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

function isExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

/**
 * Active entitlement: row is active and not past expiresAt.
 */
export async function hasActiveAccess(
  store: OnlineCourseStore,
  studentId: string,
  onlineCourseId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const access = await store.findAccess(onlineCourseId, studentId);
  if (!access || !access.isActive) return false;
  if (isExpired(access.expiresAt, now)) return false;
  return true;
}

export async function grantAccess(
  store: OnlineCourseStore,
  input: {
    onlineCourseId: string;
    studentId: string;
    grantedByUserId: string | null;
    expiresAt?: Date | null;
  },
): Promise<OnlineCourseAccess> {
  const course = await store.findById(input.onlineCourseId);
  if (!course || !course.isActive) {
    throw new OnlineCourseNotFoundError();
  }

  const expiresAt =
    input.expiresAt === undefined ? null : input.expiresAt;
  const existing = await store.findAccess(
    input.onlineCourseId,
    input.studentId,
  );

  if (existing) {
    const updated = await store.updateAccess(existing.id, {
      isActive: true,
      grantedByUserId: input.grantedByUserId,
      expiresAt,
      grantedAt: new Date(),
    });
    return toOnlineCourseAccessDto(updated);
  }

  try {
    const created = await store.createAccess({
      onlineCourseId: input.onlineCourseId,
      studentId: input.studentId,
      grantedByUserId: input.grantedByUserId,
      expiresAt,
    });
    return toOnlineCourseAccessDto(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Race: another grant won the unique constraint — reactivate.
      const raced = await store.findAccess(
        input.onlineCourseId,
        input.studentId,
      );
      if (!raced) {
        throw new OnlineCourseConflictError(
          'Access unique constraint violated.',
        );
      }
      const updated = await store.updateAccess(raced.id, {
        isActive: true,
        grantedByUserId: input.grantedByUserId,
        expiresAt,
        grantedAt: new Date(),
      });
      return toOnlineCourseAccessDto(updated);
    }
    throw error;
  }
}

export async function revokeAccess(
  store: OnlineCourseStore,
  onlineCourseId: string,
  studentId: string,
): Promise<OnlineCourseAccess> {
  const existing = await store.findAccess(onlineCourseId, studentId);
  if (!existing) {
    throw new OnlineCourseNotFoundError('Access not found.');
  }
  const updated = await store.updateAccess(existing.id, { isActive: false });
  return toOnlineCourseAccessDto(updated);
}

/**
 * Self-enroll for free courses only (amountMinor null or 0).
 * Does not create Charge/Payment rows.
 */
export async function enrollFree(
  store: OnlineCourseStore,
  studentId: string,
  onlineCourseId: string,
): Promise<OnlineCourseAccess> {
  const course = await store.findById(onlineCourseId);
  if (!course || !course.isActive) {
    throw new OnlineCourseNotFoundError();
  }
  if (course.status !== 'PUBLISHED') {
    throw new OnlineCourseValidationError(
      'Only published online courses can be enrolled.',
    );
  }
  if (!isOnlineCourseFree(course.amountMinor)) {
    throw new OnlineCourseForbiddenError(
      'This online course is not free; payment is required.',
    );
  }

  return grantAccess(store, {
    onlineCourseId,
    studentId,
    grantedByUserId: null,
    expiresAt: null,
  });
}

export function isAccessCurrentlyActive(
  access: OnlineCourseAccessRecord,
  now: Date = new Date(),
): boolean {
  return access.isActive && !isExpired(access.expiresAt, now);
}
