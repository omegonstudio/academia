import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { FinanceCurrency, PaymentProvider } from '@academia/shared';

/**
 * Payment provider boundary.
 *
 * MANUAL is always available. Mercado Pago / Stripe use live HTTP adapters when
 * credentials are configured; otherwise stubs keep local/CI offline.
 */

export type ProviderPaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface CreateProviderPaymentInput {
  amountMinor: bigint;
  currency: FinanceCurrency;
  chargeId: string;
  studentId: string;
  idempotencyKey: string;
  /** Absolute success/cancel URLs for hosted checkout. */
  successUrl?: string;
  cancelUrl?: string;
  /**
   * Absolute webhook notification URL (Mercado Pago `notification_url`).
   * Prefer API_PUBLIC_URL (ngrok / public API) over the web origin.
   */
  notificationUrl?: string;
}

export interface ProviderPaymentRef {
  providerPaymentId: string;
  /** Hosted checkout URL when the PSP returns one (Preference / Checkout Session). */
  checkoutUrl?: string | null;
}

export interface ProviderPaymentSnapshot {
  providerPaymentId: string;
  status: ProviderPaymentStatus;
  /** Major-unit amount from the provider (e.g. 125.5). */
  amountMajor?: number;
  currency?: string;
  /** Our Charge id when stored as external_reference / client_reference. */
  externalReference?: string | null;
  rawStatus?: string;
}

export interface PaymentProviderPort {
  readonly name: PaymentProvider;
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentRef>;
  getPayment(providerPaymentId: string): Promise<ProviderPaymentSnapshot>;
  /** Re-resolve hosted checkout URL for an existing provider reference (optional). */
  getCheckoutUrl?(providerPaymentId: string): Promise<string | null>;
}

export interface PaymentProviderCredentials {
  mercadopagoAccessToken: string;
  mercadopagoWebhookSecret: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  appPublicUrl: string;
  /**
   * Public base URL of the API (no trailing slash). Used for Mercado Pago
   * `notification_url`. Example: `https://abc.ngrok-free.app` → webhook at
   * `/finance/webhooks/mercado-pago`.
   */
  apiPublicUrl?: string;
  /** Force stubs even if credentials exist (tests). */
  forceStubs?: boolean;
  /**
   * When true (production), missing webhook secrets reject notifications
   * instead of skipping verification.
   */
  requireWebhookSignature?: boolean;
  /**
   * Allow APP_USR (live) Mercado Pago tokens outside production.
   * Sandbox checkout must use TEST- tokens unless this is explicitly true.
   */
  allowLiveMercadoPagoInDev?: boolean;
  /** Runtime NODE_ENV for credential safety checks. */
  nodeEnv?: string;
}

/** Prefer sandbox checkout URL only for explicit TEST- access tokens. */
export function isMercadoPagoTestAccessToken(accessToken: string): boolean {
  return /^TEST-/i.test(accessToken);
}

/**
 * Mercado Pago only accepts `auto_return` when `back_urls.success` is a
 * publicly reachable URL (not localhost / private hosts).
 */
export function isMercadoPagoAutoReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isMercadoPagoLiveAccessToken(accessToken: string): boolean {
  if (!accessToken) return false;
  if (isMercadoPagoTestAccessToken(accessToken)) return false;
  return /^APP_USR-/i.test(accessToken);
}

/**
 * Block accidental live Preference / Payment API calls from local/dev unless
 * explicitly opted in.
 */
export function assertMercadoPagoTokenAllowed(
  accessToken: string,
  credentials?: PaymentProviderCredentials,
): void {
  if (!isMercadoPagoLiveAccessToken(accessToken)) return;
  const nodeEnv = credentials?.nodeEnv ?? process.env['NODE_ENV'] ?? 'development';
  if (nodeEnv === 'production') return;
  if (credentials?.allowLiveMercadoPagoInDev === true) return;
  throw new Error(
    'Mercado Pago live Access Token (APP_USR) is blocked outside production. Use a TEST- sandbox token, or set MERCADOPAGO_ALLOW_LIVE_IN_DEV=true only with explicit authorization.',
  );
}

/** Admin-recorded payment — no external PSP. */
export class ManualPaymentProvider implements PaymentProviderPort {
  readonly name = 'MANUAL' as const;

  async createPayment(
    _input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    return { providerPaymentId: `manual_${randomUUID()}` };
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentSnapshot> {
    return { providerPaymentId, status: 'PENDING' };
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

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentSnapshot> {
    return { providerPaymentId, status: 'PENDING' };
  }

  async getCheckoutUrl(_providerPaymentId: string): Promise<string | null> {
    return null;
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

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentSnapshot> {
    return { providerPaymentId, status: 'PENDING' };
  }
}


function mapMercadoPagoPaymentStatus(status: string): ProviderPaymentStatus {
  switch (status) {
    case 'approved':
      return 'SUCCEEDED';
    case 'rejected':
      return 'FAILED';
    case 'cancelled':
      return 'CANCELLED';
    case 'refunded':
    case 'charged_back':
      return 'REFUNDED';
    case 'pending':
    case 'in_process':
    case 'authorized':
    case 'in_mediation':
    default:
      return 'PENDING';
  }
}

export interface MercadoPagoPaymentResource {
  id: number | string;
  status: string;
  transaction_amount: number;
  currency_id: string;
  external_reference?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Live Mercado Pago Checkout Pro (Preferences) + Payments API.
 */
export class MercadoPagoPaymentProvider implements PaymentProviderPort {
  readonly name = 'MERCADOPAGO' as const;

  constructor(
    private readonly accessToken: string,
    private readonly appPublicUrl: string,
    private readonly apiPublicUrl?: string,
    private readonly credentials?: PaymentProviderCredentials,
  ) {
    assertMercadoPagoTokenAllowed(accessToken, credentials);
  }

  private authHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

  defaultNotificationUrl(): string | undefined {
    const base = (this.apiPublicUrl ?? '').replace(/\/$/, '');
    if (!base) return undefined;
    return `${base}/finance/webhooks/mercado-pago?source_news=webhooks`;
  }

  async createPayment(
    input: CreateProviderPaymentInput,
  ): Promise<ProviderPaymentRef> {
    const base = this.appPublicUrl.replace(/\/$/, '');
    const unitPrice = Number(input.amountMinor) / 100;
    const notificationUrl =
      input.notificationUrl ?? this.defaultNotificationUrl();

    const successUrl =
      input.successUrl ?? `${base}/dashboard/student/finance`;
    const cancelUrl =
      input.cancelUrl ?? `${base}/dashboard/student/finance`;
    const bodyPayload: Record<string, unknown> = {
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
        success: successUrl,
        pending: cancelUrl,
        failure: cancelUrl,
      },
    };
    // MP rejects auto_return when back_urls.success is localhost / non-public.
    const autoReturnAllowed = isMercadoPagoAutoReturnUrl(successUrl);
    if (autoReturnAllowed) {
      bodyPayload.auto_return = 'approved';
    }
    if (notificationUrl) {
      bodyPayload.notification_url = notificationUrl;
    }

    const response = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: this.authHeaders(input.idempotencyKey),
        body: JSON.stringify(bodyPayload),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Mercado Pago preference failed (${response.status})${
          detail ? `: ${detail.slice(0, 200)}` : ''
        }`,
      );
    }

    const body = (await response.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
    };
    if (!body.id) {
      throw new Error('Mercado Pago preference missing id');
    }

    const preferSandbox = isMercadoPagoTestAccessToken(this.accessToken);
    const checkoutUrl = preferSandbox
      ? (body.sandbox_init_point ?? body.init_point ?? null)
      : (body.init_point ?? body.sandbox_init_point ?? null);

    return {
      providerPaymentId: body.id,
      checkoutUrl,
    };
  }

  async getCheckoutUrl(providerPaymentId: string): Promise<string | null> {
    if (providerPaymentId.startsWith('mp_stub_')) return null;
    assertMercadoPagoTokenAllowed(this.accessToken, this.credentials);
    const response = await fetch(
      `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(providerPaymentId)}`,
      { headers: this.authHeaders() },
    );
    if (!response.ok) {
      throw new Error(
        `Mercado Pago preference fetch failed (${response.status})`,
      );
    }
    const body = (await response.json()) as {
      init_point?: string;
      sandbox_init_point?: string;
    };
    const preferSandbox = isMercadoPagoTestAccessToken(this.accessToken);
    return preferSandbox
      ? (body.sandbox_init_point ?? body.init_point ?? null)
      : (body.init_point ?? body.sandbox_init_point ?? null);
  }

  /**
   * Fetch a Payment resource by Mercado Pago payment id (not preference id).
   */
  async fetchPaymentResource(
    mercadoPagoPaymentId: string,
  ): Promise<MercadoPagoPaymentResource> {
    assertMercadoPagoTokenAllowed(this.accessToken, this.credentials);
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(mercadoPagoPaymentId)}`,
      { headers: this.authHeaders() },
    );
    if (response.status === 404) {
      throw new MercadoPagoResourceNotFoundError(mercadoPagoPaymentId);
    }
    if (!response.ok) {
      throw new MercadoPagoTemporaryError(
        `Mercado Pago payment fetch failed (${response.status})`,
      );
    }
    return (await response.json()) as MercadoPagoPaymentResource;
  }

  async getPayment(
    providerPaymentId: string,
  ): Promise<ProviderPaymentSnapshot> {
    // Preference ids are not payment statuses — keep PENDING until a payment
    // webhook supplies the real payment id.
    if (
      providerPaymentId.startsWith('mp_stub_') ||
      !/^\d+$/.test(providerPaymentId)
    ) {
      return { providerPaymentId, status: 'PENDING' };
    }
    const resource = await this.fetchPaymentResource(providerPaymentId);
    return mapMercadoPagoResourceToSnapshot(resource);
  }
}

export function mapMercadoPagoResourceToSnapshot(
  resource: MercadoPagoPaymentResource,
): ProviderPaymentSnapshot {
  return {
    providerPaymentId: String(resource.id),
    status: mapMercadoPagoPaymentStatus(resource.status),
    amountMajor: resource.transaction_amount,
    currency: resource.currency_id,
    externalReference: resource.external_reference ?? null,
    rawStatus: resource.status,
  };
}

export class MercadoPagoResourceNotFoundError extends Error {
  constructor(id: string) {
    super(`Mercado Pago payment not found: ${id}`);
    this.name = 'MercadoPagoResourceNotFoundError';
  }
}

export class MercadoPagoTemporaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MercadoPagoTemporaryError';
  }
}

/** Convert MP major-unit amount to minor units (centavos / cents). */
export function majorAmountToMinor(amountMajor: number): bigint {
  if (!Number.isFinite(amountMajor)) {
    throw new Error('Invalid provider amount.');
  }
  return BigInt(Math.round(amountMajor * 100));
}

export interface StripeCheckoutSessionResource {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  url?: string | null;
}

export class StripeResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeResourceNotFoundError';
  }
}

export class StripeTemporaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeTemporaryError';
  }
}

export class StripePaymentProvider implements PaymentProviderPort {
  readonly name = 'STRIPE' as const;

  constructor(
    private readonly secretKey: string,
    private readonly appPublicUrl: string,
  ) {}

  private authHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

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
    params.set(
      'line_items[0][price_data][currency]',
      input.currency.toLowerCase(),
    );
    params.set(
      'line_items[0][price_data][unit_amount]',
      input.amountMinor.toString(),
    );
    params.set(
      'line_items[0][price_data][product_data][name]',
      'Academia — cargo',
    );

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: this.authHeaders(input.idempotencyKey),
      body: params.toString(),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Stripe Checkout Session failed (${response.status})${
          detail ? `: ${detail.slice(0, 200)}` : ''
        }`,
      );
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

  async fetchCheckoutSession(
    sessionId: string,
  ): Promise<StripeCheckoutSessionResource> {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: this.authHeaders() },
    );
    if (response.status === 404) {
      throw new StripeResourceNotFoundError(
        `Stripe Checkout Session not found: ${sessionId}`,
      );
    }
    if (response.status >= 500) {
      throw new StripeTemporaryError(
        `Stripe Checkout Session temporarily unavailable (${response.status})`,
      );
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Stripe Checkout Session fetch failed (${response.status})${
          detail ? `: ${detail.slice(0, 200)}` : ''
        }`,
      );
    }
    return (await response.json()) as StripeCheckoutSessionResource;
  }

  async getPayment(
    providerPaymentId: string,
  ): Promise<ProviderPaymentSnapshot> {
    if (providerPaymentId.startsWith('stripe_stub_')) {
      return { providerPaymentId, status: 'PENDING' };
    }
    const resource = await this.fetchCheckoutSession(providerPaymentId);
    return mapStripeSessionToSnapshot(resource);
  }

  async getCheckoutUrl(providerPaymentId: string): Promise<string | null> {
    if (providerPaymentId.startsWith('stripe_stub_')) return null;
    const resource = await this.fetchCheckoutSession(providerPaymentId);
    return resource.url ?? null;
  }
}

/**
 * Map a Stripe Checkout Session to our provider snapshot.
 * Stripe `amount_total` is already in minor units (cents); we expose major
 * for parity with Mercado Pago (`majorAmountToMinor`).
 */
export function mapStripeSessionToSnapshot(
  resource: StripeCheckoutSessionResource,
): ProviderPaymentSnapshot {
  const paymentStatus = (resource.payment_status ?? '').toLowerCase();
  const sessionStatus = (resource.status ?? '').toLowerCase();
  let status: ProviderPaymentStatus = 'PENDING';
  if (paymentStatus === 'paid') {
    status = 'SUCCEEDED';
  } else if (sessionStatus === 'expired') {
    status = 'CANCELLED';
  } else if (
    paymentStatus === 'unpaid' &&
    (sessionStatus === 'complete' || sessionStatus === 'open')
  ) {
    status = 'PENDING';
  }

  const amountTotal =
    typeof resource.amount_total === 'number' ? resource.amount_total : undefined;
  const amountMajor =
    amountTotal !== undefined ? amountTotal / 100 : undefined;

  const fromClientRef = resource.client_reference_id?.trim() || null;
  const fromMeta = resource.metadata?.['chargeId']?.trim() || null;

  return {
    providerPaymentId: String(resource.id),
    status,
    amountMajor,
    currency: resource.currency?.toUpperCase(),
    externalReference: fromClientRef ?? fromMeta,
    rawStatus: `${sessionStatus}:${paymentStatus}`,
  };
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
          credentials.apiPublicUrl,
          credentials,
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

/**
 * Mercado Pago x-signature: HMAC-SHA256 of
 * `id:[data.id];request-id:[x-request-id];ts:[ts];`
 *
 * Note: Mercado Pago docs require `data.id` lowercased when alphanumeric.
 */
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
  const normalizedId = /[a-zA-Z]/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalizedId};request-id:${requestId ?? ''};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}
