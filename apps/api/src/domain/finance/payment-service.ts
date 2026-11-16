import type { PaymentProvider } from '@academia/shared';
import {
  isValidProviderCurrencyPair,
  splitAmountMinor,
} from '@academia/shared';
import {
  FinanceConflictError,
  FinanceInvalidTransitionError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type {
  ChargeRecord,
  PaymentRecord,
  RevenueAllocationRecord,
} from './finance-types.js';
import { requireFinanceSettings } from './finance-settings-service.js';
import { assertPaymentTransition } from './payment-transitions.js';

export interface SucceedPaymentResult {
  payment: PaymentRecord;
  charge: ChargeRecord;
  allocation: RevenueAllocationRecord;
}

export async function createPayment(
  store: FinanceStore,
  input: {
    chargeId: string;
    provider: PaymentProvider;
    idempotencyKey: string;
    providerPaymentId?: string | null;
    createdByUserId?: string | null;
  },
): Promise<PaymentRecord> {
  const existingKey = await store.findPaymentByIdempotencyKey(
    input.idempotencyKey,
  );
  if (existingKey) {
    if (existingKey.chargeId !== input.chargeId) {
      throw new FinanceConflictError(
        'idempotencyKey already used for a different Charge.',
      );
    }
    return existingKey;
  }

  if (input.providerPaymentId) {
    const existingProvider = await store.findPaymentByProviderReference(
      input.provider,
      input.providerPaymentId,
    );
    if (existingProvider) {
      throw new FinanceConflictError(
        'providerPaymentId already registered for this provider.',
      );
    }
  }

  const charge = await store.findChargeById(input.chargeId);
  if (!charge) throw new FinanceNotFoundError('Charge not found.');
  if (charge.status !== 'OPEN') {
    throw new FinanceValidationError(
      `Payment requires an OPEN Charge (got ${charge.status}).`,
    );
  }

  // At most one live Payment (PENDING|SUCCEEDED). FAILED/CANCELLED history may
  // remain (DECISIONS #53). Partials are still forbidden.
  const existingForCharge = await store.findPaymentByChargeId(input.chargeId);
  if (
    existingForCharge &&
    (existingForCharge.status === 'PENDING' ||
      existingForCharge.status === 'SUCCEEDED')
  ) {
    throw new FinanceConflictError(
      'Charge already has a live Payment (PENDING or SUCCEEDED).',
    );
  }

  if (!isValidProviderCurrencyPair(input.provider, charge.currency)) {
    throw new FinanceValidationError(
      `Invalid provider/currency pair: ${input.provider} / ${charge.currency}.`,
    );
  }

  try {
    return await store.createPayment({
      studentId: charge.studentId,
      chargeId: charge.id,
      amountMinor: charge.amountMinor,
      currency: charge.currency,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId ?? null,
      idempotencyKey: input.idempotencyKey,
      createdByUserId: input.createdByUserId ?? null,
    });
  } catch (error) {
    // Concurrent create with the same idempotency key (retry race).
    if (error instanceof FinanceConflictError) {
      const raced = await store.findPaymentByIdempotencyKey(input.idempotencyKey);
      if (raced && raced.chargeId === input.chargeId) return raced;
      const live = await store.findPaymentByChargeId(input.chargeId);
      if (
        live &&
        (live.status === 'PENDING' || live.status === 'SUCCEEDED') &&
        live.chargeId === input.chargeId
      ) {
        return live;
      }
    }
    throw error;
  }
}

async function transitionPayment(
  store: FinanceStore,
  paymentId: string,
  to: PaymentRecord['status'],
): Promise<PaymentRecord> {
  const payment = await store.findPaymentById(paymentId);
  if (!payment) throw new FinanceNotFoundError('Payment not found.');
  assertPaymentTransition(payment.status, to);
  return store.updatePaymentStatus(paymentId, to);
}

export async function markPaymentFailed(
  store: FinanceStore,
  paymentId: string,
): Promise<PaymentRecord> {
  return transitionPayment(store, paymentId, 'FAILED');
}

export async function markPaymentCancelled(
  store: FinanceStore,
  paymentId: string,
): Promise<PaymentRecord> {
  return transitionPayment(store, paymentId, 'CANCELLED');
}

/**
 * Atomic: Payment → SUCCEEDED + Charge → PAID + ORIGINAL RevenueAllocation.
 * Percentage and teacherId are resolved server-side — never trusted from caller.
 */
export async function succeedPayment(
  store: FinanceStore,
  paymentId: string,
): Promise<SucceedPaymentResult> {
  return store.runInTransaction(async (tx) => {
    const payment = await tx.findPaymentById(paymentId);
    if (!payment) throw new FinanceNotFoundError('Payment not found.');

    const charge = await tx.findChargeById(payment.chargeId);
    if (!charge) throw new FinanceNotFoundError('Charge not found.');
    if (charge.status !== 'OPEN') {
      throw new FinanceValidationError(
        `SUCCEEDED requires OPEN Charge (got ${charge.status}).`,
      );
    }
    if (
      charge.amountMinor !== payment.amountMinor ||
      charge.currency !== payment.currency
    ) {
      throw new FinanceValidationError(
        'Payment snapshot does not match Charge snapshot.',
      );
    }

    const siblings = await tx.listPayments({ chargeId: charge.id });
    const otherSucceeded = siblings.find(
      (row) => row.id !== payment.id && row.status === 'SUCCEEDED',
    );
    if (otherSucceeded) {
      throw new FinanceConflictError(
        'Charge already has a succeeded Payment.',
      );
    }

    const recoveringTerminal =
      payment.status === 'FAILED' || payment.status === 'CANCELLED';
    assertPaymentTransition(payment.status, 'SUCCEEDED', {
      allowTerminalRecovery: recoveringTerminal,
    });

    // Late PSP confirmation of an older attempt: cancel any newer PENDING so the
    // partial unique live index and ledger stay single-SUCCEEDED (#53).
    if (recoveringTerminal) {
      for (const sibling of siblings) {
        if (sibling.id === payment.id) continue;
        if (sibling.status !== 'PENDING') continue;
        assertPaymentTransition(sibling.status, 'CANCELLED');
        await tx.updatePaymentStatus(sibling.id, 'CANCELLED');
      }
    }

    const existingAllocation = await tx.findAllocationByPaymentAndKind(
      payment.id,
      'ORIGINAL',
    );
    if (existingAllocation) {
      throw new FinanceConflictError(
        'ORIGINAL RevenueAllocation already exists for this Payment.',
      );
    }

    const settings = await requireFinanceSettings(tx);
    const teacherId = await tx.resolveTeacherIdForCharge(charge);
    if (!teacherId) {
      throw new FinanceValidationError(
        'Cannot resolve teacher for Charge commercial context (Group.teacherId is required).',
      );
    }

    const split = splitAmountMinor(
      payment.amountMinor,
      settings.academyPercentage,
    );

    const updatedPayment = await tx.updatePaymentStatus(payment.id, 'SUCCEEDED');
    const updatedCharge = await tx.updateChargeStatus(charge.id, 'PAID');

    if (tx.beforeCreateAllocationHook) {
      await tx.beforeCreateAllocationHook();
    }

    const allocation = await tx.createAllocation({
      paymentId: payment.id,
      chargeId: charge.id,
      studentId: payment.studentId,
      teacherId,
      courseId: charge.courseId,
      groupId: charge.groupId,
      kind: 'ORIGINAL',
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      academyPercentage: settings.academyPercentage,
      academyAmountMinor: split.academyAmountMinor,
      teacherAmountMinor: split.teacherAmountMinor,
      refundId: null,
    });

    return {
      payment: updatedPayment,
      charge: updatedCharge,
      allocation,
    };
  });
}

/** Re-export for callers that only need the transition guard. */
export { assertPaymentTransition, canTransitionPayment } from './payment-transitions.js';
export { FinanceInvalidTransitionError };
