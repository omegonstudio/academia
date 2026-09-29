import type { CourseServiceType } from '@academia/shared';
import { calendarMonthPeriodForTimezone } from './calendar-month-period.js';
import {
  createChargeForClassSession,
  createChargeForEnrollmentPeriod,
} from './charge-service.js';
import { FinanceValidationError } from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type { ChargeRecord } from './finance-types.js';

function isOneToOne(serviceType: CourseServiceType): boolean {
  return serviceType === 'ONE_TO_ONE_60' || serviceType === 'ONE_TO_ONE_90';
}

/**
 * After a ClassSession exists: ensure the ONE_TO_ONE Charge (idempotent).
 * No-ops when not ONE_TO_ONE, no active enrollment, or Course has no list price.
 * Never creates a Payment.
 */
export async function ensureAutoChargeForClassSession(
  store: FinanceStore,
  input: {
    classSessionId: string;
    createdByUserId: string;
  },
): Promise<ChargeRecord | null> {
  const existing = await store.findChargeByClassSessionId(input.classSessionId);
  if (existing) return existing;

  const enrollments = await store.listActiveEnrollmentsForClassSession(
    input.classSessionId,
  );
  if (enrollments.length === 0) return null;
  if (!isOneToOne(enrollments[0]!.serviceType)) return null;

  const studentId = [...enrollments]
    .sort((a, b) => a.studentId.localeCompare(b.studentId))[0]!.studentId;

  try {
    return await createChargeForClassSession(store, {
      classSessionId: input.classSessionId,
      studentId,
      createdByUserId: input.createdByUserId,
    });
  } catch (error) {
    if (error instanceof FinanceValidationError) return null;
    throw error;
  }
}

/**
 * After Enrollment is active: ensure the GROUP_120 Charge for the current
 * academy-timezone calendar month (idempotent). Never creates a Payment.
 */
export async function ensureAutoChargeForEnrollmentMonth(
  store: FinanceStore,
  input: {
    enrollmentId: string;
    createdByUserId: string;
    businessTimezone: string;
    now?: Date;
  },
): Promise<ChargeRecord | null> {
  const context = await store.loadEnrollmentFinanceContext(input.enrollmentId);
  if (!context) return null;
  if (context.serviceType !== 'GROUP_120') return null;

  const { periodStart, periodEnd } = calendarMonthPeriodForTimezone(
    input.now ?? new Date(),
    input.businessTimezone,
  );

  const existing = await store.findChargeByEnrollmentPeriod({
    enrollmentId: input.enrollmentId,
    periodStart,
    periodEnd,
  });
  if (existing) return existing;

  try {
    return await createChargeForEnrollmentPeriod(store, {
      enrollmentId: input.enrollmentId,
      periodStart,
      periodEnd,
      createdByUserId: input.createdByUserId,
    });
  } catch (error) {
    if (error instanceof FinanceValidationError) return null;
    throw error;
  }
}
