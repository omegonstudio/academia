import {
  moneyMinorToString,
  type AdminPaymentSubmission,
  type PaymentSubmissionEvent as PaymentSubmissionEventDto,
  type PaymentSubmissionStatus,
  type ReviewPaymentSubmissionRequest,
} from '@academia/shared';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import { serializePaymentSubmission } from './payment-submission-service.js';
import type {
  PaymentSubmissionEventRecord,
  PaymentSubmissionRecord,
  PaymentSubmissionStore,
} from './payment-submission-types.js';

const REVIEW_TRANSITIONS: Record<
  ReviewPaymentSubmissionRequest['action'],
  {
    to: PaymentSubmissionStatus;
    from: readonly PaymentSubmissionStatus[];
  }
> = {
  take_under_review: {
    to: 'UNDER_REVIEW',
    from: ['SUBMITTED', 'NEEDS_CORRECTION'],
  },
  request_correction: {
    to: 'NEEDS_CORRECTION',
    from: ['SUBMITTED', 'UNDER_REVIEW'],
  },
  reject: {
    to: 'REJECTED',
    from: ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CORRECTION'],
  },
};

export function serializeAdminPaymentSubmission(
  row: PaymentSubmissionRecord,
  charge: {
    amountMinor: bigint;
    currency: AdminPaymentSubmission['chargeCurrency'];
    status: AdminPaymentSubmission['chargeStatus'];
  },
): AdminPaymentSubmission {
  const delta = row.reportedAmountMinor - charge.amountMinor;
  return {
    ...serializePaymentSubmission(row),
    chargeAmountMinor: moneyMinorToString(charge.amountMinor),
    chargeCurrency: charge.currency,
    chargeStatus: charge.status,
    amountDeltaMinor: delta.toString(),
    amountMatchesCharge: delta === 0n,
  };
}

export function serializePaymentSubmissionEvent(
  row: PaymentSubmissionEventRecord,
): PaymentSubmissionEventDto {
  return {
    id: row.id,
    submissionId: row.submissionId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actorUserId: row.actorUserId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAdminPaymentSubmissions(
  finance: FinanceStore,
  submissions: PaymentSubmissionStore,
  query: {
    status?: PaymentSubmissionStatus;
    chargeId?: string;
    studentId?: string;
    limit: number;
    offset: number;
  },
): Promise<{
  submissions: AdminPaymentSubmission[];
  total: number;
}> {
  const all = await submissions.list({
    ...(query.status ? { status: query.status } : {}),
    ...(query.chargeId ? { chargeId: query.chargeId } : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
  });
  const page = all.slice(query.offset, query.offset + query.limit);
  const enriched: AdminPaymentSubmission[] = [];
  for (const row of page) {
    const charge = await finance.findChargeById(row.chargeId);
    if (!charge) continue;
    enriched.push(serializeAdminPaymentSubmission(row, charge));
  }
  return { submissions: enriched, total: all.length };
}

export async function getAdminPaymentSubmission(
  finance: FinanceStore,
  submissions: PaymentSubmissionStore,
  submissionId: string,
): Promise<AdminPaymentSubmission> {
  const row = await submissions.findById(submissionId);
  if (!row) throw new FinanceNotFoundError('PaymentSubmission not found.');
  const charge = await finance.findChargeById(row.chargeId);
  if (!charge) throw new FinanceNotFoundError('Charge not found.');
  return serializeAdminPaymentSubmission(row, charge);
}

/**
 * Non-ledger review actions (T5). APPROVED is handled by T6 financial approve.
 */
export async function reviewPaymentSubmission(
  submissions: PaymentSubmissionStore,
  input: {
    submissionId: string;
    actorUserId: string;
    body: ReviewPaymentSubmissionRequest;
  },
): Promise<PaymentSubmissionRecord> {
  const rule = REVIEW_TRANSITIONS[input.body.action];
  return submissions.runInTransaction(async (tx) => {
    const existing = await tx.findById(input.submissionId);
    if (!existing) {
      throw new FinanceNotFoundError('PaymentSubmission not found.');
    }
    if (existing.status === 'APPROVED') {
      throw new FinanceConflictError(
        'APPROVED PaymentSubmission cannot be reviewed again.',
      );
    }
    if (existing.status === 'REJECTED' && input.body.action !== 'take_under_review') {
      throw new FinanceConflictError(
        'REJECTED PaymentSubmission is terminal for review actions.',
      );
    }
    if (!rule.from.includes(existing.status)) {
      throw new FinanceValidationError(
        `Cannot ${input.body.action} from status ${existing.status}.`,
      );
    }
    const adminNote = input.body.adminNote?.trim() || null;
    if (
      (input.body.action === 'request_correction' ||
        input.body.action === 'reject') &&
      !adminNote
    ) {
      throw new FinanceValidationError(
        'adminNote is required for correction and reject.',
      );
    }
    const updated = await tx.update({
      id: existing.id,
      status: rule.to,
      adminNote: adminNote ?? existing.adminNote,
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
    });
    await tx.appendEvent({
      submissionId: existing.id,
      fromStatus: existing.status,
      toStatus: rule.to,
      actorUserId: input.actorUserId,
      note: adminNote,
    });
    return updated;
  });
}
