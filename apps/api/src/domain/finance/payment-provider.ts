import { randomUUID } from 'node:crypto';
import type { FinanceCurrency, PaymentProvider } from '@academia/shared';

/**
 * Payment provider boundary (Stage 6B-2).
 *
 * Live Mercado Pago / Stripe SDKs are intentionally NOT integrated yet.
 * MANUAL is fully usable for authorized admin flows; MP/Stripe adapters are
 * stubs that reserve the seam for a later stage.
 *
 * TODO: provider signature verification when SDK/provider credentials are introduced.
 */

export interface CreateProviderPaymentInput {
  amountMinor: bigint;
  currency: FinanceCurrency;
  chargeId: string;
  studentId: string;
  idempotencyKey: string;
}

export interface ProviderPaymentRef {
  providerPaymentId: string;
}

export interface PaymentProviderPort {
  readonly name: PaymentProvider;
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentRef>;
  getPayment(
    providerPaymentId: string,
  ): Promise<{ providerPaymentId: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' }>;
}

/** Admin-recorded payment — no external PSP. */
export class ManualPaymentProvider implements PaymentProviderPort {
  readonly name = 'MANUAL' as const;

  async createPayment(
    _input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    return { providerPaymentId: `manual_${randomUUID()}` };
  }

  async getPayment(providerPaymentId: string) {
    return { providerPaymentId, status: 'PENDING' as const };
  }
}

/**
 * Stub — no Mercado Pago SDK.
 * TODO: provider signature verification when SDK/provider credentials are introduced.
 */
export class StubMercadoPagoProvider implements PaymentProviderPort {
  readonly name = 'MERCADOPAGO' as const;

  async createPayment(
    _input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    return { providerPaymentId: `mp_stub_${randomUUID()}` };
  }

  async getPayment(providerPaymentId: string) {
    return { providerPaymentId, status: 'PENDING' as const };
  }
}

/**
 * Stub — no Stripe SDK.
 * TODO: provider signature verification when SDK/provider credentials are introduced.
 */
export class StubStripeProvider implements PaymentProviderPort {
  readonly name = 'STRIPE' as const;

  async createPayment(
    _input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    return { providerPaymentId: `stripe_stub_${randomUUID()}` };
  }

  async getPayment(providerPaymentId: string) {
    return { providerPaymentId, status: 'PENDING' as const };
  }
}

export function resolvePaymentProvider(
  provider: PaymentProvider,
): PaymentProviderPort {
  switch (provider) {
    case 'MANUAL':
      return new ManualPaymentProvider();
    case 'MERCADOPAGO':
      return new StubMercadoPagoProvider();
    case 'STRIPE':
      return new StubStripeProvider();
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown payment provider: ${_exhaustive}`);
    }
  }
}
