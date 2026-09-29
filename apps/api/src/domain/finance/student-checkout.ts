import { providerForCurrency } from '@academia/shared';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type { PaymentRecord } from './finance-types.js';
import { resolvePaymentProvider } from './payment-provider.js';
import { createPayment } from './payment-service.js';

/**
 * Student-initiated checkout for an owned OPEN Charge.
 *
 * Provider is derived from currency (ARS→MP, USD→Stripe). MANUAL is never
 * used here — that path remains admin-only.
 *
 * Idempotency: deterministic key `student-checkout:{studentId}:{chargeId}` plus
 * re-entry when a PENDING Payment already exists for the Charge.
 */
export async function startStudentCheckout(
  store: FinanceStore,
  input: {
    studentId: string;
    chargeId: string;
    createdByUserId: string;
  },
): Promise<PaymentRecord> {
  const charge = await store.findChargeById(input.chargeId);
  if (!charge || charge.studentId !== input.studentId) {
    throw new FinanceNotFoundError('Charge not found.');
  }
  if (charge.status !== 'OPEN') {
    throw new FinanceValidationError(
      `Checkout requires an OPEN Charge (got ${charge.status}).`,
    );
  }

  const existing = await store.findPaymentByChargeId(charge.id);
  if (existing) {
    if (existing.status === 'PENDING') {
      return existing;
    }
    throw new FinanceConflictError(
      'Charge already has a Payment that cannot be restarted.',
    );
  }

  const provider = providerForCurrency(charge.currency);
  const idempotencyKey = `student-checkout:${input.studentId}:${charge.id}`;
  const providerRef = await resolvePaymentProvider(provider).createPayment({
    amountMinor: charge.amountMinor,
    currency: charge.currency,
    chargeId: charge.id,
    studentId: charge.studentId,
    idempotencyKey,
  });

  return createPayment(store, {
    chargeId: charge.id,
    provider,
    idempotencyKey,
    providerPaymentId: providerRef.providerPaymentId,
    createdByUserId: input.createdByUserId,
  });
}
