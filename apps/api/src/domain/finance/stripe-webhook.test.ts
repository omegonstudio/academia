import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateFinanceSettings } from './finance-settings-service.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import {
  mapStripeSessionToSnapshot,
  StripePaymentProvider,
  verifyStripeWebhookSignature,
} from './payment-provider.js';
import { createPayment } from './payment-service.js';
import {
  parseStripeEvent,
  processStripeNativeWebhook,
} from './stripe-webhook.js';

const STRIPE_SECRET = 'sk_test_fake_for_unit_tests';
const STRIPE_WHSEC = 'whsec_test_stripe_signature';

function signStripe(rawBody: string, secret = STRIPE_WHSEC): string {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const v1 = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

describe('StripePaymentProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a Checkout Session and returns url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_abc',
        url: 'https://checkout.stripe.com/c/pay/cs_test_abc',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new StripePaymentProvider(
      STRIPE_SECRET,
      'http://localhost:3000',
    );
    const ref = await provider.createPayment({
      amountMinor: 3000n,
      currency: 'USD',
      chargeId: '00000000-0000-4000-8000-000000000001',
      studentId: '00000000-0000-4000-8000-000000000002',
      idempotencyKey: 'stripe-k1',
    });

    expect(ref.providerPaymentId).toBe('cs_test_abc');
    expect(ref.checkoutUrl).toContain('checkout.stripe.com');
    const body = (fetchMock.mock.calls[0]![1] as { body: string }).body;
    expect(body).toContain(
      'client_reference_id=00000000-0000-4000-8000-000000000001',
    );
    expect(body).toContain('unit_amount%5D=3000');
  });

  it('getPayment maps paid Checkout Session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'cs_test_paid',
          status: 'complete',
          payment_status: 'paid',
          amount_total: 3000,
          currency: 'usd',
          client_reference_id: '00000000-0000-4000-8000-000000000001',
        }),
      }),
    );
    const provider = new StripePaymentProvider(
      STRIPE_SECRET,
      'http://localhost:3000',
    );
    const snap = await provider.getPayment('cs_test_paid');
    expect(snap.status).toBe('SUCCEEDED');
    expect(snap.amountMajor).toBe(30);
    expect(snap.currency).toBe('USD');
    expect(snap.externalReference).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
  });
});

describe('mapStripeSessionToSnapshot / signature', () => {
  it('maps expired session to CANCELLED', () => {
    const snap = mapStripeSessionToSnapshot({
      id: 'cs_x',
      status: 'expired',
      payment_status: 'unpaid',
      amount_total: 100,
      currency: 'eur',
      client_reference_id: 'charge-1',
    });
    expect(snap.status).toBe('CANCELLED');
  });

  it('verifies stripe-signature v1', () => {
    const raw = '{"id":"evt_1"}';
    const header = signStripe(raw);
    expect(verifyStripeWebhookSignature(raw, header, STRIPE_WHSEC)).toBe(true);
    expect(verifyStripeWebhookSignature(raw, header, 'wrong')).toBe(false);
  });

  it('parseStripeEvent accepts native Event shape', () => {
    expect(
      parseStripeEvent({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_1' } },
      })?.type,
    ).toBe('checkout.session.completed');
  });
});

describe('processStripeNativeWebhook', () => {
  const studentId = randomUUID();
  const teacherId = randomUUID();
  const actorUserId = randomUUID();

  let store: ReturnType<typeof createInMemoryFinanceStore>;
  let chargeId: string;
  let paymentId: string;

  const credentials = {
    mercadopagoAccessToken: '',
    mercadopagoWebhookSecret: '',
    stripeSecretKey: STRIPE_SECRET,
    stripeWebhookSecret: STRIPE_WHSEC,
    appPublicUrl: 'http://localhost:3000',
    requireWebhookSignature: true,
  };

  beforeEach(async () => {
    store = createInMemoryFinanceStore();
    vi.unstubAllGlobals();
    await getOrCreateFinanceSettings(store);
    const classSessionId = randomUUID();
    const courseId = randomUUID();
    const groupId = randomUUID();
    store.seedClassSession({
      classSessionId,
      studentId,
      groupId,
      courseId,
      serviceType: 'ONE_TO_ONE_60',
      teacherId,
      courseAmountMinor: 3000n,
      courseCurrency: 'USD',
      studentEnrolled: true,
    });
    const charge = await store.createCharge({
      studentId,
      amountMinor: 3000n,
      currency: 'USD',
      courseId,
      groupId,
      enrollmentId: null,
      classSessionId,
      periodStart: null,
      periodEnd: null,
      description: 'Stripe test',
      createdByUserId: actorUserId,
    });
    chargeId = charge.id;
    const payment = await createPayment(store, {
      chargeId,
      provider: 'STRIPE',
      idempotencyKey: `stripe-${chargeId}`,
      providerPaymentId: 'cs_test_live_1',
      createdByUserId: actorUserId,
    });
    paymentId = payment.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubSession(overrides: Record<string, unknown> = {}) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'cs_test_live_1',
          status: 'complete',
          payment_status: 'paid',
          amount_total: 3000,
          currency: 'usd',
          client_reference_id: chargeId,
          ...overrides,
        }),
      }),
    );
  }

  it('succeeds Payment + Charge + ORIGINAL from checkout.session.completed', async () => {
    stubSession();
    const event = {
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_live_1' } },
    };
    const first = await processStripeNativeWebhook(store, {
      event,
      credentials,
      signatureVerified: true,
    });
    expect(first).toMatchObject({
      httpStatus: 200,
      duplicate: false,
      processed: true,
    });

    const paid = await store.findPaymentById(paymentId);
    expect(paid?.status).toBe('SUCCEEDED');
    const charged = await store.findChargeById(chargeId);
    expect(charged?.status).toBe('PAID');
    const allocs = await store.listAllocations({ paymentId });
    expect(allocs).toHaveLength(1);
    expect(allocs[0]!.kind).toBe('ORIGINAL');

    const second = await processStripeNativeWebhook(store, {
      event,
      credentials,
      signatureVerified: true,
    });
    expect(second.duplicate).toBe(true);
    const allocsAfter = await store.listAllocations({ paymentId });
    expect(allocsAfter).toHaveLength(1);
  });

  it('rejects unsigned events when webhook secret is configured', async () => {
    stubSession();
    const result = await processStripeNativeWebhook(store, {
      event: {
        id: 'evt_x',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_live_1' } },
      },
      credentials,
      signatureVerified: false,
    });
    expect(result.httpStatus).toBe(401);
  });

  it('rejects amount mismatch', async () => {
    stubSession({ amount_total: 9999 });
    const result = await processStripeNativeWebhook(store, {
      event: {
        id: 'evt_amt',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_live_1' } },
      },
      credentials,
      signatureVerified: true,
    });
    expect(result.httpStatus).toBe(400);
  });
});
