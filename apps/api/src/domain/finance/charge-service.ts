import type { CourseServiceType } from '@academia/shared';
import { FinanceValidationError } from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type { ChargeRecord } from './finance-types.js';

function assertPricedCourse(context: {
  courseAmountMinor: bigint | null;
  courseCurrency: string | null;
}): asserts context is {
  courseAmountMinor: bigint;
  courseCurrency: 'ARS' | 'USD';
} {
  if (context.courseAmountMinor === null || context.courseCurrency === null) {
    throw new FinanceValidationError(
      'Course must have amountMinor and currency before creating a Charge.',
    );
  }
  if (context.courseAmountMinor < 0n) {
    throw new FinanceValidationError('Course amountMinor must be non-negative.');
  }
}

function isOneToOne(serviceType: CourseServiceType): boolean {
  return serviceType === 'ONE_TO_ONE_60' || serviceType === 'ONE_TO_ONE_90';
}

/**
 * ONE_TO_ONE_60|90 — Charge linked to ClassSession; price snapshot from Course.
 */
export async function createChargeForClassSession(
  store: FinanceStore,
  input: {
    classSessionId: string;
    studentId: string;
    createdByUserId: string;
    description?: string | null;
  },
): Promise<ChargeRecord> {
  const context = await store.loadClassSessionFinanceContext({
    classSessionId: input.classSessionId,
    studentId: input.studentId,
  });
  if (!context) {
    throw new FinanceValidationError('ClassSession not found.');
  }
  if (!isOneToOne(context.serviceType)) {
    throw new FinanceValidationError(
      `ClassSession Charge requires ONE_TO_ONE course (got ${context.serviceType}).`,
    );
  }
  if (!context.studentEnrolled) {
    throw new FinanceValidationError(
      'Student is not enrolled in the ClassSession group.',
    );
  }
  assertPricedCourse(context);

  return store.createCharge({
    studentId: input.studentId,
    amountMinor: context.courseAmountMinor,
    currency: context.courseCurrency,
    courseId: context.courseId,
    groupId: context.groupId,
    enrollmentId: null,
    classSessionId: context.classSessionId,
    description: input.description ?? null,
    createdByUserId: input.createdByUserId,
    periodStart: null,
    periodEnd: null,
  });
}

/**
 * GROUP_120 — Charge linked to Enrollment + calendar-month period.
 * Does not auto-generate monthly charges; caller supplies the period.
 */
export async function createChargeForEnrollmentPeriod(
  store: FinanceStore,
  input: {
    enrollmentId: string;
    periodStart: Date;
    periodEnd: Date;
    createdByUserId: string;
    description?: string | null;
  },
): Promise<ChargeRecord> {
  if (!(input.periodStart < input.periodEnd)) {
    throw new FinanceValidationError('periodStart must be before periodEnd.');
  }

  const context = await store.loadEnrollmentFinanceContext(input.enrollmentId);
  if (!context) {
    throw new FinanceValidationError('Enrollment not found.');
  }
  if (context.serviceType !== 'GROUP_120') {
    throw new FinanceValidationError(
      `Enrollment period Charge requires GROUP_120 (got ${context.serviceType}).`,
    );
  }
  assertPricedCourse(context);

  return store.createCharge({
    studentId: context.studentId,
    amountMinor: context.courseAmountMinor,
    currency: context.courseCurrency,
    courseId: context.courseId,
    groupId: context.groupId,
    enrollmentId: context.enrollmentId,
    classSessionId: null,
    description: input.description ?? null,
    createdByUserId: input.createdByUserId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
}

export async function cancelCharge(
  store: FinanceStore,
  chargeId: string,
): Promise<ChargeRecord> {
  const charge = await store.findChargeById(chargeId);
  if (!charge) {
    throw new FinanceValidationError('Charge not found.');
  }
  if (charge.status !== 'OPEN') {
    throw new FinanceValidationError(
      `Only OPEN charges can be cancelled (got ${charge.status}).`,
    );
  }
  const payment = await store.findPaymentByChargeId(chargeId);
  if (payment && payment.status === 'PENDING') {
    throw new FinanceValidationError(
      'Cannot cancel Charge while a PENDING Payment exists.',
    );
  }
  if (payment && payment.status === 'SUCCEEDED') {
    throw new FinanceValidationError('Cannot cancel a Charge with SUCCEEDED Payment.');
  }
  return store.updateChargeStatus(chargeId, 'CANCELLED');
}
