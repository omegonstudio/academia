import {
  FinanceConflictError,
  FinanceInvalidTransitionError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import {
  majorAmountToMinor,
  mapStripeSessionToSnapshot,
  resolvePaymentProvider,
  StripePaymentProvider,
  StripeResourceNotFoundError,
  StripeTemporaryError,
  type PaymentProviderCredentials,
  type ProviderPaymentStatus,
  type StripeCheckoutSessionResource,
} from './payment-provider.js';
import {
  markPaymentCancelled,
  markPaymentFailed,
  succeedPayment,
} from './payment-service.js';
import { processProviderWebhook } from './webhook-service.js';

export interface StripeNativeEvent {
  id?: string;
  type?: string;
  data?: { object?: StripeCheckoutSessionResource & Record<string, unknown> };
}

export type StripeWebhookHttpStatus = 200 | 400 | 401 | 503;

export interface ProcessStripeWebhookResult {
  duplicate: boolean;
  processed: boolean;
  httpStatus: StripeWebhookHttpStatus;
  reason?: string;
}

const SESSION_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

export function parseStripeEvent(body: unknown): StripeNativeEvent | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record['type'] !== 'string') return null;
  return body as StripeNativeEvent;
}

function isCheckoutSessionEvent(type: string): boolean {
  return SESSION_EVENT_TYPES.has(type);
}

/**
 * Process a native Stripe Event (Checkout Session).
 *
 * Never trusts event payload status alone: re-fetches the Session with the
 * secret key, then validates amount / currency / client_reference_id before
 * mutating the ledger.
 */
export async function processStripeNativeWebhook(
  store: FinanceStore,
  input: {
    event: StripeNativeEvent;
    credentials: PaymentProviderCredentials;
    signatureVerified: boolean;
  },
): Promise<ProcessStripeWebhookResult> {
  const { event, credentials, signatureVerified } = input;
  const secret = credentials.stripeWebhookSecret ?? '';
  const requireSignature =
    credentials.requireWebhookSignature === true || secret.length > 0;

  if (requireSignature && !signatureVerified) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 401,
      reason: 'Invalid or missing Stripe webhook signature.',
    };
  }

  if (!credentials.stripeSecretKey) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 503,
      reason: 'Stripe secret key is not configured.',
    };
  }

  const eventType = event.type ?? '';
  if (!isCheckoutSessionEvent(eventType)) {
    return {
      duplicate: false,
      processed: true,
      httpStatus: 200,
      reason: `Ignored Stripe event type: ${eventType || 'unknown'}`,
    };
  }

  const object = event.data?.object;
  const sessionId = object?.id ? String(object.id) : '';
  if (!sessionId) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Missing Stripe Checkout Session id in event.',
    };
  }

  const providerEventId =
    event.id && String(event.id).length > 0
      ? String(event.id)
      : `stripe-session:${sessionId}:${eventType}`;

  const provider = resolvePaymentProvider('STRIPE', credentials);
  if (!(provider instanceof StripePaymentProvider)) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 503,
      reason: 'Stripe live provider is not available.',
    };
  }

  let resource: StripeCheckoutSessionResource;
  try {
    resource = await provider.fetchCheckoutSession(sessionId);
  } catch (error) {
    if (error instanceof StripeResourceNotFoundError) {
      return {
        duplicate: false,
        processed: false,
        httpStatus: 400,
        reason: error.message,
      };
    }
    if (error instanceof StripeTemporaryError) {
      return {
        duplicate: false,
        processed: false,
        httpStatus: 503,
        reason: error.message,
      };
    }
    throw error;
  }

  const snapshot = mapStripeSessionToSnapshot(resource);
  const chargeId = snapshot.externalReference?.trim() || null;
  if (!chargeId) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Stripe session missing client_reference_id / metadata.chargeId.',
    };
  }

  let payment = await store.findPaymentByChargeId(chargeId);
  if (!payment) {
    payment = await store.findPaymentByProviderReference('STRIPE', sessionId);
  }
  if (!payment) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'No internal Payment for Stripe Checkout Session.',
    };
  }

  if (payment.provider !== 'STRIPE') {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Charge Payment is not routed to Stripe.',
    };
  }

  if (snapshot.amountMajor === undefined || !snapshot.currency) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Stripe session missing amount_total or currency.',
    };
  }

  let amountMinor: bigint;
  try {
    amountMinor = majorAmountToMinor(snapshot.amountMajor);
  } catch {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Invalid Stripe amount_total.',
    };
  }

  if (
    amountMinor !== payment.amountMinor ||
    snapshot.currency.toUpperCase() !== payment.currency
  ) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Provider amount/currency does not match internal Payment.',
    };
  }

  // Prefer session payment_status; event type is a hint for failed/expired.
  let status: ProviderPaymentStatus = snapshot.status;
  if (eventType === 'checkout.session.expired') {
    status = 'CANCELLED';
  } else if (eventType === 'checkout.session.async_payment_failed') {
    status = 'FAILED';
  } else if (
    eventType === 'checkout.session.completed' ||
    eventType === 'checkout.session.async_payment_succeeded'
  ) {
    if (snapshot.status === 'SUCCEEDED') {
      status = 'SUCCEEDED';
    }
  }

  const internalType =
    status === 'SUCCEEDED'
      ? 'payment.succeeded'
      : status === 'FAILED'
        ? 'payment.failed'
        : status === 'CANCELLED'
          ? 'payment.cancelled'
          : 'payment.pending';

  try {
    const result = await processProviderWebhook(store, {
      provider: 'STRIPE',
      providerEventId,
      type: internalType,
      paymentId: payment.id,
      payload: {
        stripeSessionId: sessionId,
        eventType,
        rawStatus: snapshot.rawStatus,
      },
      apply: async () => {
        await applyStripeStatus(store, payment!.id, status);
      },
    });
    return {
      duplicate: result.duplicate,
      processed: result.processed,
      httpStatus: 200,
    };
  } catch (error) {
    if (
      error instanceof FinanceValidationError ||
      error instanceof FinanceNotFoundError
    ) {
      return {
        duplicate: false,
        processed: false,
        httpStatus: 400,
        reason: error.message,
      };
    }
    throw error;
  }
}

async function applyStripeStatus(
  store: FinanceStore,
  paymentId: string,
  status: ProviderPaymentStatus,
): Promise<void> {
  const payment = await store.findPaymentById(paymentId);
  if (!payment) throw new FinanceNotFoundError('Payment not found.');

  if (status === 'PENDING') {
    return;
  }

  if (status === 'SUCCEEDED') {
    if (payment.status === 'SUCCEEDED' || payment.status === 'REFUNDED') {
      return;
    }
    try {
      await succeedPayment(store, paymentId);
    } catch (error) {
      if (
        error instanceof FinanceConflictError ||
        error instanceof FinanceInvalidTransitionError
      ) {
        return;
      }
      throw error;
    }
    return;
  }

  if (status === 'FAILED') {
    if (payment.status !== 'PENDING') return;
    try {
      await markPaymentFailed(store, paymentId);
    } catch (error) {
      if (error instanceof FinanceInvalidTransitionError) return;
      throw error;
    }
    return;
  }

  if (status === 'CANCELLED') {
    if (payment.status !== 'PENDING') return;
    try {
      await markPaymentCancelled(store, paymentId);
    } catch (error) {
      if (error instanceof FinanceInvalidTransitionError) return;
      throw error;
    }
  }
}
