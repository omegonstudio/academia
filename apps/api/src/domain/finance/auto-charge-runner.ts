import type { FinanceStore } from './finance-store.js';
import {
  ensureAutoChargeForClassSession,
  ensureAutoChargeForEnrollmentMonth,
} from './auto-charge.js';

/**
 * Best-effort auto-charge after an authorized academic write.
 * Academic entity is already committed (separate store); failures that are not
 * validation skips are rethrown so operators see them. Validation skips
 * (wrong service type / no price / no enrollment) are silent no-ops.
 */
export async function runAutoChargeForClassSession(
  finance: FinanceStore,
  input: { classSessionId: string; createdByUserId: string },
): Promise<void> {
  await ensureAutoChargeForClassSession(finance, input);
}

export async function runAutoChargeForClassSessions(
  finance: FinanceStore,
  input: { classSessionIds: string[]; createdByUserId: string },
): Promise<void> {
  for (const classSessionId of input.classSessionIds) {
    await ensureAutoChargeForClassSession(finance, {
      classSessionId,
      createdByUserId: input.createdByUserId,
    });
  }
}

export async function runAutoChargeForEnrollmentMonth(
  finance: FinanceStore,
  input: {
    enrollmentId: string;
    createdByUserId: string;
    businessTimezone: string;
  },
): Promise<void> {
  await ensureAutoChargeForEnrollmentMonth(finance, input);
}
