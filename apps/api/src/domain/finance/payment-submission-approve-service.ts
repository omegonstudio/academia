import type { ApprovePaymentSubmissionRequest } from '@academia/shared';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import {
  createPayment,
  markPaymentCancelled,
  succeedPayment,
} from './payment-service.js';
import {
  serializeAdminPaymentSubmission,
} from './payment-submission-review-service.js';
import type { PaymentSubmissionStore } from './payment-submission-types.js';

const APPROVABLE: ReadonlySet<string> = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_CORRECTION',
]);

export function submissionApproveIdempotencyKey(submissionId: string): string {
  return `submission-approve:${submissionId}`;
}

/**
 * T6 — approve a PaymentSubmission into the finance ledger.
 *
 * Creates/confirm MANUAL Payment for the full Charge amount, SUCCEEDED +
 * Charge PAID + ORIGINAL allocation (#44), then marks submission APPROVED.
 * Does not allow partial amounts. Idempotent on submission id.
 */
export async function approvePaymentSubmission(
  finance: FinanceStore,
  submissions: PaymentSubmissionStore,
  input: {
    submissionId: string;
    actorUserId: string;
    body: ApprovePaymentSubmissionRequest;
  },
) {
  if (input.body.moneyReceivedConfirmed !== true) {
    throw new FinanceValidationError(
      'moneyReceivedConfirmed must be true to approve.',
    );
  }

  const submission = await submissions.findById(input.submissionId);
  if (!submission) {
    throw new FinanceNotFoundError('PaymentSubmission not found.');
  }

  if (submission.status === 'APPROVED') {
    const charge = await finance.findChargeById(submission.chargeId);
    if (!charge) throw new FinanceNotFoundError('Charge not found.');
    return serializeAdminPaymentSubmission(submission, charge);
  }

  if (submission.status === 'REJECTED') {
    throw new FinanceConflictError('Cannot approve a REJECTED submission.');
  }
  if (!APPROVABLE.has(submission.status)) {
    throw new FinanceValidationError(
      `Cannot approve from status ${submission.status}.`,
    );
  }
  if (!submission.receiptStorageKey) {
    throw new FinanceValidationError(
      'Cannot approve without an attached receipt file.',
    );
  }

  const charge = await finance.findChargeById(submission.chargeId);
  if (!charge) throw new FinanceNotFoundError('Charge not found.');
  if (charge.studentId !== submission.studentId) {
    throw new FinanceValidationError('Submission student does not own Charge.');
  }
  if (charge.status !== 'OPEN') {
    throw new FinanceValidationError(
      `Approve requires OPEN Charge (got ${charge.status}).`,
    );
  }
  if (submission.reportedCurrency !== charge.currency) {
    throw new FinanceValidationError(
      'reportedCurrency must match Charge currency.',
    );
  }
  if (submission.reportedAmountMinor !== charge.amountMinor) {
    throw new FinanceValidationError(
      'reportedAmountMinor must equal Charge amountMinor (partials are not allowed).',
    );
  }

  const idempotencyKey = submissionApproveIdempotencyKey(submission.id);
  const existingPayment = await finance.findPaymentByIdempotencyKey(
    idempotencyKey,
  );
  if (existingPayment?.status === 'SUCCEEDED') {
    // Ledger already applied; finish marking submission APPROVED.
  } else {
    // Free the live unique slot if a PSP attempt is still PENDING.
    const siblings = await finance.listPayments({ chargeId: charge.id });
    for (const sibling of siblings) {
      if (sibling.status === 'PENDING') {
        await markPaymentCancelled(finance, sibling.id);
      }
    }

    const payment =
      existingPayment ??
      (await createPayment(finance, {
        chargeId: charge.id,
        provider: 'MANUAL',
        idempotencyKey,
        providerPaymentId: `submission:${submission.id}`,
        createdByUserId: input.actorUserId,
      }));

    if (payment.status !== 'SUCCEEDED') {
      await succeedPayment(finance, payment.id);
    }
  }

  const adminNote = input.body.adminNote?.trim() || submission.adminNote;
  const approved = await submissions.runInTransaction(async (tx) => {
    const latest = await tx.findById(submission.id);
    if (!latest) throw new FinanceNotFoundError('PaymentSubmission not found.');
    if (latest.status === 'APPROVED') return latest;
    const updated = await tx.update({
      id: latest.id,
      status: 'APPROVED',
      adminNote,
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
    });
    await tx.appendEvent({
      submissionId: latest.id,
      fromStatus: latest.status,
      toStatus: 'APPROVED',
      actorUserId: input.actorUserId,
      note: adminNote,
    });
    return updated;
  });

  const paidCharge = await finance.findChargeById(charge.id);
  if (!paidCharge) throw new FinanceNotFoundError('Charge not found.');
  return serializeAdminPaymentSubmission(approved, paidCharge);
}
