import type { FinanceCurrency } from '@academia/shared';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type { TeacherSettlementRecord } from './finance-types.js';

/**
 * teacher owed = sum(teacherAmountMinor) over allocations with createdAt in
 * [periodStart, periodEnd). ORIGINAL (+) and REVERSAL (-) net correctly.
 * Currency must be homogeneous — no FX.
 */
export async function calculateTeacherOwed(
  store: FinanceStore,
  input: {
    teacherId: string;
    periodStart: Date;
    periodEnd: Date;
    currency: FinanceCurrency;
  },
): Promise<bigint> {
  if (!(input.periodStart < input.periodEnd)) {
    throw new FinanceValidationError('periodStart must be before periodEnd.');
  }

  const rows = await store.listAllocationsForTeacherPeriod({
    teacherId: input.teacherId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currency: input.currency,
  });

  let total = 0n;
  for (const row of rows) {
    if (row.currency !== input.currency) {
      throw new FinanceValidationError(
        'Mixed currencies in settlement period — no FX; use one currency per settlement.',
      );
    }
    total += row.teacherAmountMinor;
  }
  return total;
}

export async function createTeacherSettlement(
  store: FinanceStore,
  input: {
    teacherId: string;
    periodStart: Date;
    periodEnd: Date;
    currency: FinanceCurrency;
    note?: string | null;
  },
): Promise<TeacherSettlementRecord> {
  if (!(input.periodStart < input.periodEnd)) {
    throw new FinanceValidationError('periodStart must be before periodEnd.');
  }

  const existing = await store.findSettlementByKey({
    teacherId: input.teacherId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currency: input.currency,
  });
  if (existing) {
    throw new FinanceConflictError(
      'TeacherSettlement already exists for this teacher/period/currency.',
    );
  }

  const total = await calculateTeacherOwed(store, {
    teacherId: input.teacherId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currency: input.currency,
  });

  return store.createSettlement({
    teacherId: input.teacherId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalTeacherAmountMinor: total,
    currency: input.currency,
    note: input.note ?? null,
  });
}

export async function markTeacherSettlementPaid(
  store: FinanceStore,
  settlementId: string,
  note?: string | null,
): Promise<TeacherSettlementRecord> {
  const existing = await store.findSettlementById(settlementId);
  if (!existing) {
    throw new FinanceNotFoundError('TeacherSettlement not found.');
  }
  if (existing.status === 'MARKED_PAID') {
    throw new FinanceConflictError('TeacherSettlement is already MARKED_PAID.');
  }
  return store.markSettlementPaid(settlementId, note ?? null);
}
