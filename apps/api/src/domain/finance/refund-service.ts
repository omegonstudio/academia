import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type {
  PaymentRecord,
  RefundRecord,
  RevenueAllocationRecord,
} from './finance-types.js';
import { assertPaymentTransition } from './payment-transitions.js';

export interface ConfirmTotalRefundResult {
  refund: RefundRecord;
  payment: PaymentRecord;
  originalAllocation: RevenueAllocationRecord;
  reversalAllocation: RevenueAllocationRecord;
}

/**
 * Total refund only. Creates Refund + REVERSAL allocation (negative minors)
 * and transitions Payment → REFUNDED. ORIGINAL allocation is left intact.
 */
export async function confirmTotalRefund(
  store: FinanceStore,
  input: {
    paymentId: string;
    reason?: string | null;
    createdByUserId?: string | null;
  },
): Promise<ConfirmTotalRefundResult> {
  return store.runInTransaction(async (tx) => {
    const payment = await tx.findPaymentById(input.paymentId);
    if (!payment) throw new FinanceNotFoundError('Payment not found.');
    assertPaymentTransition(payment.status, 'REFUNDED');

    const existingRefund = await tx.findRefundByPaymentId(payment.id);
    if (existingRefund) {
      throw new FinanceConflictError('Payment already has a Refund.');
    }

    const existingReversal = await tx.findAllocationByPaymentAndKind(
      payment.id,
      'REVERSAL',
    );
    if (existingReversal) {
      throw new FinanceConflictError(
        'REVERSAL RevenueAllocation already exists for this Payment.',
      );
    }

    const original = await tx.findAllocationByPaymentAndKind(
      payment.id,
      'ORIGINAL',
    );
    if (!original) {
      throw new FinanceValidationError(
        'Cannot refund Payment without ORIGINAL RevenueAllocation.',
      );
    }

    const refund = await tx.createRefund({
      paymentId: payment.id,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      reason: input.reason ?? null,
      createdByUserId: input.createdByUserId ?? null,
    });

    const updatedPayment = await tx.updatePaymentStatus(payment.id, 'REFUNDED');

    const reversal = await tx.createAllocation({
      paymentId: payment.id,
      chargeId: original.chargeId,
      studentId: original.studentId,
      teacherId: original.teacherId,
      courseId: original.courseId,
      groupId: original.groupId,
      kind: 'REVERSAL',
      amountMinor: -original.amountMinor,
      currency: original.currency,
      academyPercentage: original.academyPercentage,
      academyAmountMinor: -original.academyAmountMinor,
      teacherAmountMinor: -original.teacherAmountMinor,
      refundId: refund.id,
    });

    return {
      refund,
      payment: updatedPayment,
      originalAllocation: original,
      reversalAllocation: reversal,
    };
  });
}
