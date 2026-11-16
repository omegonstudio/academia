import { providerForCurrency } from '@academia/shared';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type { PaymentRecord } from './finance-types.js';
import {
  resolvePaymentProvider,
  type PaymentProviderCredentials,
} from './payment-provider.js';
import { createPayment } from './payment-service.js';

export interface StudentCheckoutResult {
  payment: PaymentRecord;
  checkoutUrl: string | null;
}

/**
 * Student-initiated checkout for an owned OPEN Charge.
 *
 * Provider is derived from currency (ARS→MP, USD/EUR→Stripe). MANUAL is never
 * used here — that path remains admin-only.
 *
 * Idempotency:
 * - First attempt: `student-checkout:{studentId}:{chargeId}`
 * - PENDING re-entry: same Payment + same key; URL re-resolved
 * - Retry after FAILED/CANCELLED: new Payment with
 *   `student-checkout:{studentId}:{chargeId}:retry:{priorPaymentId}`
 *   so history is preserved and concurrent retries collapse on the same key
 *   (DECISIONS #53).
 */
export async function startStudentCheckout(
  store: FinanceStore,
  input: {
    studentId: string;
    chargeId: string;
    createdByUserId: string;
    credentials?: PaymentProviderCredentials;
  },
): Promise<StudentCheckoutResult> {
  const charge = await store.findChargeById(input.chargeId);
  if (!charge || charge.studentId !== input.studentId) {
    throw new FinanceNotFoundError('Charge not found.');
  }
  if (charge.status !== 'OPEN') {
    throw new FinanceValidationError(
      `Checkout requires an OPEN Charge (got ${charge.status}).`,
    );
  }

  const paymentsForCharge = await store.listPayments({ chargeId: charge.id });
  const live = paymentsForCharge.find(
    (row) => row.status === 'PENDING' || row.status === 'SUCCEEDED',
  );
  if (live?.status === 'SUCCEEDED') {
    throw new FinanceConflictError(
      'Charge already has a succeeded Payment.',
    );
  }
  if (live?.status === 'PENDING') {
    const checkoutUrl = await resolveCheckoutUrlForPending(
      live,
      charge,
      input.credentials,
    );
    return { payment: live, checkoutUrl };
  }

  const latestTerminal = paymentsForCharge
    .filter((row) => row.status === 'FAILED' || row.status === 'CANCELLED')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  const provider = providerForCurrency(charge.currency);
  const idempotencyKey = latestTerminal
    ? `student-checkout:${input.studentId}:${charge.id}:retry:${latestTerminal.id}`
    : `student-checkout:${input.studentId}:${charge.id}`;
  const adapter = resolvePaymentProvider(provider, input.credentials);
  const notificationUrl =
    provider === 'MERCADOPAGO'
      ? buildMercadoPagoNotificationUrl(input.credentials)
      : undefined;

  const providerRef = await adapter.createPayment({
    amountMinor: charge.amountMinor,
    currency: charge.currency,
    chargeId: charge.id,
    studentId: charge.studentId,
    idempotencyKey,
    notificationUrl,
  });

  const payment = await createPayment(store, {
    chargeId: charge.id,
    provider,
    idempotencyKey,
    providerPaymentId: providerRef.providerPaymentId,
    createdByUserId: input.createdByUserId,
  });

  return {
    payment,
    checkoutUrl: providerRef.checkoutUrl ?? null,
  };
}

function buildMercadoPagoNotificationUrl(
  credentials?: PaymentProviderCredentials,
): string | undefined {
  const base = (credentials?.apiPublicUrl ?? '').replace(/\/$/, '');
  if (!base) return undefined;
  return `${base}/finance/webhooks/mercado-pago?source_news=webhooks`;
}

async function resolveCheckoutUrlForPending(
  payment: PaymentRecord,
  charge: {
    amountMinor: bigint;
    currency: PaymentRecord['currency'];
    id: string;
    studentId: string;
  },
  credentials?: PaymentProviderCredentials,
): Promise<string | null> {
  if (!payment.providerPaymentId) return null;
  const adapter = resolvePaymentProvider(payment.provider, credentials);
  if (adapter.getCheckoutUrl) {
    try {
      return await adapter.getCheckoutUrl(payment.providerPaymentId);
    } catch {
      // Fall through to recreate with the same idempotency key.
    }
  }
  try {
    const notificationUrl =
      payment.provider === 'MERCADOPAGO'
        ? buildMercadoPagoNotificationUrl(credentials)
        : undefined;
    const ref = await adapter.createPayment({
      amountMinor: charge.amountMinor,
      currency: charge.currency,
      chargeId: charge.id,
      studentId: charge.studentId,
      idempotencyKey: payment.idempotencyKey,
      notificationUrl,
    });
    return ref.checkoutUrl ?? null;
  } catch {
    return null;
  }
}
