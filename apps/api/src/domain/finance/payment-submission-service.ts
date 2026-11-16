import {
  moneyMinorToString,
  type CreatePaymentSubmissionRequest,
  type PaymentSubmission as PaymentSubmissionDto,
} from '@academia/shared';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type {
  PaymentSubmissionRecord,
  PaymentSubmissionStore,
} from './payment-submission-types.js';

export function serializePaymentSubmission(
  row: PaymentSubmissionRecord,
): PaymentSubmissionDto {
  return {
    id: row.id,
    chargeId: row.chargeId,
    studentId: row.studentId,
    reportedAmountMinor: moneyMinorToString(row.reportedAmountMinor),
    reportedCurrency: row.reportedCurrency,
    paidAt: row.paidAt.toISOString(),
    hasReceipt: Boolean(row.receiptStorageKey),
    receiptFilename: row.receiptFilename,
    receiptMimeType: row.receiptMimeType,
    receiptSizeBytes: row.receiptSizeBytes,
    status: row.status,
    studentNote: row.studentNote,
    adminNote: row.adminNote,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Student creates a transfer-receipt submission for an owned OPEN Charge.
 * Does not create Payment, Allocation, or change Charge status.
 */
export async function createPaymentSubmission(
  finance: FinanceStore,
  submissions: PaymentSubmissionStore,
  input: {
    studentId: string;
    actorUserId: string;
    body: CreatePaymentSubmissionRequest;
  },
): Promise<PaymentSubmissionRecord> {
  const charge = await finance.findChargeById(input.body.chargeId);
  if (!charge || charge.studentId !== input.studentId) {
    throw new FinanceNotFoundError('Charge not found.');
  }
  if (charge.status !== 'OPEN') {
    throw new FinanceValidationError(
      `PaymentSubmission requires an OPEN Charge (got ${charge.status}).`,
    );
  }

  const amountMinor = BigInt(input.body.reportedAmountMinor);
  if (amountMinor <= 0n) {
    throw new FinanceValidationError('reportedAmountMinor must be positive.');
  }
  if (input.body.reportedCurrency !== charge.currency) {
    throw new FinanceValidationError(
      'reportedCurrency must match the Charge currency.',
    );
  }

  const paidAt = new Date(input.body.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new FinanceValidationError('paidAt is invalid.');
  }

  const approved = await submissions.list({
    chargeId: charge.id,
    status: 'APPROVED',
  });
  if (approved.length > 0) {
    throw new FinanceConflictError(
      'Charge already has an APPROVED PaymentSubmission.',
    );
  }

  return submissions.runInTransaction(async (tx) => {
    const created = await tx.create({
      chargeId: charge.id,
      studentId: input.studentId,
      reportedAmountMinor: amountMinor,
      reportedCurrency: input.body.reportedCurrency,
      paidAt,
      studentNote: input.body.studentNote?.trim() || null,
    });
    await tx.appendEvent({
      submissionId: created.id,
      fromStatus: null,
      toStatus: 'SUBMITTED',
      actorUserId: input.actorUserId,
      note: null,
    });
    return created;
  });
}

export async function listStudentPaymentSubmissions(
  submissions: PaymentSubmissionStore,
  input: { studentId: string; chargeId?: string },
): Promise<PaymentSubmissionRecord[]> {
  return submissions.list({
    studentId: input.studentId,
    ...(input.chargeId ? { chargeId: input.chargeId } : {}),
  });
}

export async function getOwnedPaymentSubmission(
  submissions: PaymentSubmissionStore,
  input: { studentId: string; submissionId: string },
): Promise<PaymentSubmissionRecord> {
  const row = await submissions.findById(input.submissionId);
  if (!row || row.studentId !== input.studentId) {
    throw new FinanceNotFoundError('PaymentSubmission not found.');
  }
  return row;
}
