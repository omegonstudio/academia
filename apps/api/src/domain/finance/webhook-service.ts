import type { PaymentProvider } from '@academia/shared';
import {
  FinanceConflictError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import { succeedPayment } from './payment-service.js';

export interface ProcessWebhookResult {
  duplicate: boolean;
  processed: boolean;
}

/** In-process lock so concurrent identical events share one apply path. */
const inflightWebhooks = new Map<string, Promise<ProcessWebhookResult>>();

/**
 * Idempotent webhook inbox processor.
 *
 * Persists WebhookEvent under unique (provider, providerEventId). Replaying the
 * same event does not duplicate Payment transitions or RevenueAllocations.
 *
 * Signature verification is the HTTP layer's responsibility (provider-specific).
 */
export async function processProviderWebhook(
  store: FinanceStore,
  input: {
    provider: Exclude<PaymentProvider, 'MANUAL'>;
    providerEventId: string;
    type: string;
    paymentId?: string;
    payload: unknown;
    /**
     * Optional custom apply step (used by native Mercado Pago after resource
     * fetch). When omitted, only legacy success event types call succeedPayment.
     */
    apply?: () => Promise<void>;
  },
): Promise<ProcessWebhookResult> {
  const lockKey = `${input.provider}:${input.providerEventId}`;
  const existingInflight = inflightWebhooks.get(lockKey);
  if (existingInflight) {
    return existingInflight;
  }

  const run = processProviderWebhookUnlocked(store, input).finally(() => {
    inflightWebhooks.delete(lockKey);
  });
  inflightWebhooks.set(lockKey, run);
  return run;
}

async function processProviderWebhookUnlocked(
  store: FinanceStore,
  input: {
    provider: Exclude<PaymentProvider, 'MANUAL'>;
    providerEventId: string;
    type: string;
    paymentId?: string;
    payload: unknown;
    apply?: () => Promise<void>;
  },
): Promise<ProcessWebhookResult> {
  let event = await store.findWebhookEvent(
    input.provider,
    input.providerEventId,
  );

  if (!event) {
    try {
      event = await store.createWebhookEvent({
        provider: input.provider,
        providerEventId: input.providerEventId,
        payload: {
          type: input.type,
          paymentId: input.paymentId ?? null,
          payload: input.payload ?? null,
        },
      });
    } catch (error) {
      if (!(error instanceof FinanceConflictError)) throw error;
      event = await store.findWebhookEvent(
        input.provider,
        input.providerEventId,
      );
      if (!event) throw error;
    }
  }

  if (event.processedAt) {
    return { duplicate: true, processed: true };
  }

  try {
    if (input.apply) {
      await input.apply();
    } else {
      const isSuccess =
        input.type === 'payment.succeeded' ||
        input.type === 'payment_intent.succeeded' ||
        input.type === 'payment.updated.succeeded';

      if (isSuccess) {
        if (!input.paymentId) {
          throw new FinanceValidationError(
            'payment.succeeded webhook requires paymentId.',
          );
        }
        try {
          await succeedPayment(store, input.paymentId);
        } catch (error) {
          // Idempotent replay: payment may already be SUCCEEDED with allocation.
          if (!(error instanceof FinanceConflictError)) {
            throw error;
          }
        }
      }
    }

    await store.markWebhookProcessed(event.id, { error: null });
    return { duplicate: false, processed: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : 'Webhook failed.';
    await store.markWebhookProcessed(event.id, { error: message });
    throw error;
  }
}
