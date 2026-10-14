import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { FinanceCurrency, PaymentProvider } from '@academia/shared';

/**
 * Payment provider boundary.
 *
 * MANUAL is always available. Mercado Pago / Stripe use live HTTP adapters when
 * credentials are configured; otherwise stubs keep local/CI offline.
 */

export interface CreateProviderPaymentInput {
  amountMinor: bigint;
  currency: FinanceCurrency;
  chargeId: string;
  studentId: string;
  idempotencyKey: string;
  /** Absolute success/cancel URLs for hosted checkout. */
  successUrl?: string;
  cancelUrl?: string;
}

export interface ProviderPaymentRef {
  providerPaymentId: string;
  /** Hosted checkout URL when the PSP returns one (Preference / Checkout Session). */
  checkoutUrl?: string | null;
}

export interface PaymentProviderPort {
  readonly name: PaymentProvider;
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentRef>;
  getPayment(
    providerPaymentId: string,
  ): Promise<{ providerPaymentId: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' }>;
}

export interface PaymentProviderCredentials {
  mercadopagoAccessToken: string;
  mercadopagoWebhookSecret: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  appPublicUrl: string;
  /** Force stubs even if credentials exist (tests). */
  forceStubs?: boolean;
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

export class StubMercadoPagoProvider implements PaymentProviderPort {
  readonly name = 'MERCADOPAGO' as const;

  async createPayment(
    _input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    return {
      providerPaymentId: `mp_stub_${randomUUID()}`,
      checkoutUrl: null,
    };
  }

  async getPayment(providerPaymentId: string) {
    return { providerPaymentId, status: 'PENDING' as const };
  }
}

export class StubStripeProvider implements PaymentProviderPort {
  readonly name = 'STRIPE' as const;

  async createPayment(
    _input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    return {
      providerPaymentId: `stripe_stub_${randomUUID()}`,
      checkoutUrl: null,
    };
  }

  async getPayment(providerPaymentId: string) {
    return { providerPaymentId, status: 'PENDING' as const };
  }
}

export class MercadoPagoPaymentProvider implements PaymentProviderPort {
  readonly name = 'MERCADOPAGO' as const;

  constructor(
    private readonly accessToken: string,
    private readonly appPublicUrl: string,
  ) {}

  async createPayment(
    input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    const base = this.appPublicUrl.replace(/\/$/, '');
    const unitPrice = Number(input.amountMinor) / 100;
    const response = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          external_reference: input.chargeId,
          metadata: {
            chargeId: input.chargeId,
            studentId: input.studentId,
          },
          items: [
            {
              id: input.chargeId,
              title: 'Academia — cargo',
              quantity: 1,
              currency_id: input.currency,
              unit_price: unitPrice,
            },
          ],
          back_urls: {
            success: input.successUrl ?? `${base}/dashboard/student/finance`,
            pending: input.cancelUrl ?? `${base}/dashboard/student/finance`,
            failure: input.cancelUrl ?? `${base}/dashboard/student/finance`,
          },
          auto_return: 'approved',
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Mercado Pago preference failed (${response.status})`);
    }

    const body = (await response.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
    };
    if (!body.id) {
      throw new Error('Mercado Pago preference missing id');
    }
    return {
      providerPaymentId: body.id,
      checkoutUrl: body.init_point ?? body.sandbox_init_point ?? null,
    };
  }

  async getPayment(providerPaymentId: string) {
    return { providerPaymentId, status: 'PENDING' as const };
  }
}

export class StripePaymentProvider implements PaymentProviderPort {
  readonly name = 'STRIPE' as const;

  constructor(
    private readonly secretKey: string,
    private readonly appPublicUrl: string,
  ) {}

  async createPayment(
    input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    const base = this.appPublicUrl.replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set(
      'success_url',
      input.successUrl ?? `${base}/dashboard/student/finance?paid=1`,
    );
    params.set(
      'cancel_url',
      input.cancelUrl ?? `${base}/dashboard/student/finance?cancelled=1`,
    );
    params.set('client_reference_id', input.chargeId);
    params.set('metadata[chargeId]', input.chargeId);
    params.set('metadata[studentId]', input.studentId);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
    params.set(
      'line_items[0][price_data][unit_amount]',
      input.amountMinor.toString(),
    );
    params.set('line_items[0][price_data][product_data][name]', 'Academia — cargo');

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Stripe Checkout Session failed (${response.status})`);
    }

    const body = (await response.json()) as {
      id?: string;
      url?: string | null;
    };
    if (!body.id) {
      throw new Error('Stripe Checkout Session missing id');
    }
    return {
      providerPaymentId: body.id,
      checkoutUrl: body.url ?? null,
    };
  }

  async getPayment(providerPaymentId: string) {
    return { providerPaymentId, status: 'PENDING' as const };
  }
}

export function resolvePaymentProvider(
  provider: PaymentProvider,
  credentials?: PaymentProviderCredentials,
): PaymentProviderPort {
  const forceStubs = credentials?.forceStubs === true;
  switch (provider) {
    case 'MANUAL':
      return new ManualPaymentProvider();
    case 'MERCADOPAGO':
      if (
        !forceStubs &&
        credentials?.mercadopagoAccessToken &&
        credentials.mercadopagoAccessToken.length > 0
      ) {
        return new MercadoPagoPaymentProvider(
          credentials.mercadopagoAccessToken,
          credentials.appPublicUrl || 'http://localhost:3000',
        );
      }
      return new StubMercadoPagoProvider();
    case 'STRIPE':
      if (
        !forceStubs &&
        credentials?.stripeSecretKey &&
        credentials.stripeSecretKey.length > 0
      ) {
        return new StripePaymentProvider(
          credentials.stripeSecretKey,
          credentials.appPublicUrl || 'http://localhost:3000',
        );
      }
      return new StubStripeProvider();
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown payment provider: ${_exhaustive}`);
    }
  }
}

/** Verify Stripe webhook signature (v1). */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [k, v] = part.split('=');
      return [k?.trim() ?? '', v?.trim() ?? ''];
    }),
  );
  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

/** Mercado Pago x-signature: ts + v1 HMAC of `id:[data.id];request-id:[x-request-id];ts:[ts];`. */
export function verifyMercadoPagoWebhookSignature(options: {
  secret: string;
  dataId: string;
  requestId: string | undefined;
  signatureHeader: string | undefined;
}): boolean {
  const { secret, dataId, requestId, signatureHeader } = options;
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [k, v] = part.split('=');
      return [k?.trim() ?? '', v?.trim() ?? ''];
    }),
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId ?? ''};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}
