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

/**
 * Idempotent webhook inbox processor.
 *
 * Persists WebhookEvent under unique (provider, providerEventId). Replaying the
 * same event does not duplicate Payment transitions or RevenueAllocations.
 *
 * TODO: provider signature verification when SDK/provider credentials are introduced.
 * This handler does NOT claim signatures were validated.
 */
export async function processProviderWebhook(
  store: FinanceStore,
  input: {
    provider: Exclude<PaymentProvider, 'MANUAL'>;
    providerEventId: string;
    type: string;
    paymentId?: string;
    payload: unknown;
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

  const isSuccess =
    input.type === 'payment.succeeded' ||
    input.type === 'payment_intent.succeeded' ||
    input.type === 'payment.updated.succeeded';

  try {
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

    await store.markWebhookProcessed(event.id, { error: null });
    return { duplicate: false, processed: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : 'Webhook failed.';
    await store.markWebhookProcessed(event.id, { error: message });
    throw error;
  }
}
