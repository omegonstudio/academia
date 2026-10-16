import {
  FinanceConflictError,
  FinanceInvalidTransitionError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import {
  majorAmountToMinor,
  mapMercadoPagoResourceToSnapshot,
  MercadoPagoPaymentProvider,
  MercadoPagoResourceNotFoundError,
  MercadoPagoTemporaryError,
  resolvePaymentProvider,
  type PaymentProviderCredentials,
} from './payment-provider.js';
import {
  markPaymentCancelled,
  markPaymentFailed,
  succeedPayment,
} from './payment-service.js';
import { confirmTotalRefund } from './refund-service.js';
import { processProviderWebhook } from './webhook-service.js';

export interface MercadoPagoNativeNotification {
  /** Notification id (used for inbox idempotency when present). */
  id?: number | string;
  type?: string;
  topic?: string;
  action?: string;
  data?: { id?: string | number };
  /** IPN-style query id */
  resourceId?: string;
}

export type MercadoPagoWebhookHttpStatus = 200 | 400 | 401 | 503;

export interface ProcessMercadoPagoWebhookResult {
  duplicate: boolean;
  processed: boolean;
  httpStatus: MercadoPagoWebhookHttpStatus;
  reason?: string;
}

function extractMercadoPagoPaymentId(
  notification: MercadoPagoNativeNotification,
): string | null {
  const fromData = notification.data?.id;
  if (fromData !== undefined && fromData !== null && String(fromData).length > 0) {
    return String(fromData);
  }
  if (notification.resourceId && String(notification.resourceId).length > 0) {
    return String(notification.resourceId);
  }
  return null;
}

function isPaymentTopic(notification: MercadoPagoNativeNotification): boolean {
  const type = (notification.type ?? notification.topic ?? '').toLowerCase();
  return type === 'payment' || type === '';
}

/**
 * Process a native Mercado Pago Webhooks / IPN notification.
 *
 * Never trusts `action` or body status alone: always fetches the Payment
 * resource with the access token, then validates amount / currency /
 * external_reference before mutating the ledger.
 */
export async function processMercadoPagoNativeWebhook(
  store: FinanceStore,
  input: {
    notification: MercadoPagoNativeNotification;
    credentials: PaymentProviderCredentials;
    /** Pre-verified by HTTP layer; still required when secrets are configured. */
    signatureVerified: boolean;
  },
): Promise<ProcessMercadoPagoWebhookResult> {
  const { notification, credentials, signatureVerified } = input;
  const secret = credentials.mercadopagoWebhookSecret ?? '';
  const requireSignature =
    credentials.requireWebhookSignature === true || secret.length > 0;

  if (requireSignature && !signatureVerified) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 401,
      reason: 'Invalid or missing Mercado Pago webhook signature.',
    };
  }

  if (!credentials.mercadopagoAccessToken) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 503,
      reason: 'Mercado Pago access token is not configured.',
    };
  }

  if (!isPaymentTopic(notification)) {
    // Acknowledge non-payment topics so MP does not retry forever.
    return {
      duplicate: false,
      processed: true,
      httpStatus: 200,
      reason: `Ignored topic/type: ${notification.type ?? notification.topic ?? 'unknown'}`,
    };
  }

  const mpPaymentId = extractMercadoPagoPaymentId(notification);
  if (!mpPaymentId) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Missing Mercado Pago payment id in notification.',
    };
  }

  const providerEventId =
    notification.id !== undefined && notification.id !== null
      ? `mp-notif:${notification.id}`
      : `mp-payment:${mpPaymentId}:${notification.action ?? notification.type ?? 'payment'}`;

  const provider = resolvePaymentProvider('MERCADOPAGO', credentials);
  if (!(provider instanceof MercadoPagoPaymentProvider)) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 503,
      reason: 'Mercado Pago live provider is not available.',
    };
  }

  let resource;
  try {
    resource = await provider.fetchPaymentResource(mpPaymentId);
  } catch (error) {
    if (error instanceof MercadoPagoResourceNotFoundError) {
      return {
        duplicate: false,
        processed: false,
        httpStatus: 400,
        reason: error.message,
      };
    }
    if (error instanceof MercadoPagoTemporaryError) {
      return {
        duplicate: false,
        processed: false,
        httpStatus: 503,
        reason: error.message,
      };
    }
    throw error;
  }

  const snapshot = mapMercadoPagoResourceToSnapshot(resource);
  const chargeId = snapshot.externalReference?.trim() || null;
  if (!chargeId) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Mercado Pago payment missing external_reference.',
    };
  }

  const payment = await store.findPaymentByChargeId(chargeId);
  if (!payment) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'No internal Payment for external_reference.',
    };
  }

  if (payment.provider !== 'MERCADOPAGO') {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Charge Payment is not routed to Mercado Pago.',
    };
  }

  if (snapshot.amountMajor === undefined || !snapshot.currency) {
    return {
      duplicate: false,
      processed: false,
      httpStatus: 400,
      reason: 'Mercado Pago payment missing amount or currency.',
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
      reason: 'Invalid Mercado Pago transaction_amount.',
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

  const internalType =
    snapshot.status === 'SUCCEEDED'
      ? 'payment.succeeded'
      : snapshot.status === 'FAILED'
        ? 'payment.failed'
        : snapshot.status === 'CANCELLED'
          ? 'payment.cancelled'
          : snapshot.status === 'REFUNDED'
            ? 'payment.refunded'
            : 'payment.pending';

  try {
    const result = await processProviderWebhook(store, {
      provider: 'MERCADOPAGO',
      providerEventId,
      type: internalType,
      paymentId: payment.id,
      payload: {
        mercadoPagoPaymentId: mpPaymentId,
        rawStatus: snapshot.rawStatus,
        action: notification.action ?? null,
        preferenceId: payment.providerPaymentId,
      },
      apply: async () => {
        await applyMercadoPagoStatus(store, payment.id, snapshot.status);
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

async function applyMercadoPagoStatus(
  store: FinanceStore,
  paymentId: string,
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED',
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
      // Concurrent / replay: allocation unique or transition already applied.
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
    return;
  }

  if (status === 'REFUNDED') {
    if (payment.status === 'REFUNDED') return;
    if (payment.status !== 'SUCCEEDED') return;
    try {
      await confirmTotalRefund(store, {
        paymentId,
        reason: 'mercadopago_webhook',
      });
    } catch (error) {
      if (
        error instanceof FinanceConflictError ||
        error instanceof FinanceInvalidTransitionError
      ) {
        return;
      }
      throw error;
    }
  }
}

/**
 * Parse native MP body and/or query (IPN: topic + id).
 */
export function parseMercadoPagoNotification(input: {
  body: unknown;
  query?: Record<string, unknown>;
}): MercadoPagoNativeNotification | null {
  const body =
    input.body && typeof input.body === 'object'
      ? (input.body as Record<string, unknown>)
      : {};
  const query = input.query ?? {};

  const data =
    body['data'] && typeof body['data'] === 'object'
      ? (body['data'] as { id?: string | number })
      : undefined;

  const type =
    typeof body['type'] === 'string'
      ? body['type']
      : typeof query['type'] === 'string'
        ? query['type']
        : undefined;
  const topic =
    typeof body['topic'] === 'string'
      ? body['topic']
      : typeof query['topic'] === 'string'
        ? query['topic']
        : undefined;
  const action =
    typeof body['action'] === 'string' ? body['action'] : undefined;
  const id = body['id'] as number | string | undefined;

  const resourceId =
    data?.id !== undefined
      ? String(data.id)
      : typeof query['id'] === 'string' || typeof query['id'] === 'number'
        ? String(query['id'])
        : typeof query['data.id'] === 'string'
          ? String(query['data.id'])
          : undefined;

  if (
    id === undefined &&
    !type &&
    !topic &&
    !action &&
    resourceId === undefined &&
    !data
  ) {
    return null;
  }

  return {
    id,
    type,
    topic,
    action,
    data: data ?? (resourceId ? { id: resourceId } : undefined),
    resourceId,
  };
}
