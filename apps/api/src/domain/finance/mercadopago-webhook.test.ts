import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateFinanceSettings } from './finance-settings-service.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import {
  parseMercadoPagoNotification,
  processMercadoPagoNativeWebhook,
} from './mercadopago-webhook.js';
import {
  MercadoPagoPaymentProvider,
  majorAmountToMinor,
  resolvePaymentProvider,
  verifyMercadoPagoWebhookSignature,
} from './payment-provider.js';
import { createPayment, succeedPayment } from './payment-service.js';
import { startStudentCheckout } from './student-checkout.js';

const MP_TOKEN = 'TEST-access-token';
const MP_SECRET = 'mp_whsec_test';

function signMp(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', MP_SECRET).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('MercadoPagoPaymentProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a preference and prefers sandbox_init_point for TEST tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pref_abc',
        init_point: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_abc',
        sandbox_init_point:
          'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_abc',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MercadoPagoPaymentProvider(
      MP_TOKEN,
      'http://localhost:3000',
      'https://abc.ngrok-free.app',
    );
    const ref = await provider.createPayment({
      amountMinor: 12500n,
      currency: 'ARS',
      chargeId: '00000000-0000-4000-8000-000000000001',
      studentId: '00000000-0000-4000-8000-000000000002',
      idempotencyKey: 'k1',
    });

    expect(ref.providerPaymentId).toBe('pref_abc');
    expect(ref.checkoutUrl).toContain('sandbox.mercadopago.com');
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as { body: string }).body,
    ) as { notification_url?: string; external_reference: string };
    expect(body.external_reference).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(body.notification_url).toBe(
      'https://abc.ngrok-free.app/finance/webhooks/mercado-pago?source_news=webhooks',
    );
  });

  it('surfaces provider errors when preference creation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      }),
    );
    const provider = new MercadoPagoPaymentProvider(
      MP_TOKEN,
      'http://localhost:3000',
    );
    await expect(
      provider.createPayment({
        amountMinor: 1000n,
        currency: 'ARS',
        chargeId: '00000000-0000-4000-8000-000000000001',
        studentId: '00000000-0000-4000-8000-000000000002',
        idempotencyKey: 'k-fail',
      }),
    ).rejects.toThrow(/preference failed \(401\)/);
  });

  it('getPayment maps approved payment resources', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 999,
          status: 'approved',
          transaction_amount: 125,
          currency_id: 'ARS',
          external_reference: 'charge-1',
        }),
      }),
    );
    const provider = new MercadoPagoPaymentProvider(
      MP_TOKEN,
      'http://localhost:3000',
    );
    const snap = await provider.getPayment('999');
    expect(snap.status).toBe('SUCCEEDED');
    expect(snap.amountMajor).toBe(125);
    expect(majorAmountToMinor(125)).toBe(12500n);
  });
});

describe('processMercadoPagoNativeWebhook', () => {
  const store = createInMemoryFinanceStore();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const actorUserId = randomUUID();
  let chargeId: string;
  let paymentId: string;

  const credentials = {
    mercadopagoAccessToken: MP_TOKEN,
    mercadopagoWebhookSecret: MP_SECRET,
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    appPublicUrl: 'http://localhost:3000',
    apiPublicUrl: 'https://abc.ngrok-free.app',
    requireWebhookSignature: true,
  };

  beforeEach(async () => {
    store.clear();
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
      courseAmountMinor: 12500n,
      courseCurrency: 'ARS',
      studentEnrolled: true,
    });
    const charge = await store.createCharge({
      studentId,
      amountMinor: 12500n,
      currency: 'ARS',
      courseId,
      groupId,
      enrollmentId: null,
      classSessionId,
      periodStart: null,
      periodEnd: null,
      description: 'MP test',
      createdByUserId: actorUserId,
    });
    chargeId = charge.id;
    const payment = await createPayment(store, {
      chargeId,
      provider: 'MERCADOPAGO',
      idempotencyKey: `mp-${chargeId}`,
      providerPaymentId: 'pref_test',
      createdByUserId: actorUserId,
    });
    paymentId = payment.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubMpPayment(overrides: Record<string, unknown> = {}) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 555001,
          status: 'approved',
          transaction_amount: 125,
          currency_id: 'ARS',
          external_reference: chargeId,
          ...overrides,
        }),
      }),
    );
  }

  it('approves payment after fetching provider resource (not body status alone)', async () => {
    stubMpPayment({ status: 'approved' });
    const result = await processMercadoPagoNativeWebhook(store, {
      notification: {
        id: 1,
        type: 'payment',
        action: 'payment.updated',
        data: { id: '555001' },
      },
      credentials,
      signatureVerified: true,
    });
    expect(result.httpStatus).toBe(200);
    expect(result.processed).toBe(true);
    const payment = await store.findPaymentById(paymentId);
    expect(payment!.status).toBe('SUCCEEDED');
    const charge = await store.findChargeById(chargeId);
    expect(charge!.status).toBe('PAID');
    const allocs = await store.listAllocations({ paymentId });
    expect(allocs).toHaveLength(1);
  });

  it('keeps payment PENDING when provider reports pending', async () => {
    stubMpPayment({ status: 'pending' });
    const result = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 2, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    expect(result.httpStatus).toBe(200);
    const payment = await store.findPaymentById(paymentId);
    expect(payment!.status).toBe('PENDING');
  });

  it('marks FAILED when provider reports rejected', async () => {
    stubMpPayment({ status: 'rejected' });
    const result = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 3, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    expect(result.httpStatus).toBe(200);
    const payment = await store.findPaymentById(paymentId);
    expect(payment!.status).toBe('FAILED');
  });

  it('rejects when signature is required but not verified', async () => {
    stubMpPayment();
    const result = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 4, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: false,
    });
    expect(result.httpStatus).toBe(401);
    const payment = await store.findPaymentById(paymentId);
    expect(payment!.status).toBe('PENDING');
  });

  it('rejects unknown external_reference', async () => {
    stubMpPayment({ external_reference: randomUUID() });
    const result = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 5, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    expect(result.httpStatus).toBe(400);
    expect(result.reason).toMatch(/No internal Payment/);
  });

  it('rejects amount or currency mismatch', async () => {
    stubMpPayment({ transaction_amount: 999, currency_id: 'ARS' });
    const badAmount = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 6, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    expect(badAmount.httpStatus).toBe(400);

    stubMpPayment({ transaction_amount: 125, currency_id: 'USD' });
    const badCurrency = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 7, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    expect(badCurrency.httpStatus).toBe(400);
  });

  it('is idempotent on duplicate notification ids', async () => {
    stubMpPayment();
    const first = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 80, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    const second = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 80, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    expect(first.processed).toBe(true);
    expect(second.duplicate).toBe(true);
    const allocs = await store.listAllocations({ paymentId });
    expect(allocs).toHaveLength(1);
  });

  it('handles concurrent succeed without double allocation', async () => {
    stubMpPayment();
    const notification = {
      id: 90,
      type: 'payment' as const,
      data: { id: '555001' },
    };
    const [a, b] = await Promise.all([
      processMercadoPagoNativeWebhook(store, {
        notification,
        credentials,
        signatureVerified: true,
      }),
      processMercadoPagoNativeWebhook(store, {
        notification,
        credentials,
        signatureVerified: true,
      }),
    ]);
    expect(a.httpStatus).toBe(200);
    expect(b.httpStatus).toBe(200);
    const allocs = await store.listAllocations({ paymentId });
    expect(allocs).toHaveLength(1);
  });

  it('returns 503 on temporary provider fetch errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'busy',
      }),
    );
    const result = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 91, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    expect(result.httpStatus).toBe(503);
  });

  it('does not reverse SUCCEEDED when a late rejected notification arrives', async () => {
    stubMpPayment({ status: 'approved' });
    await processMercadoPagoNativeWebhook(store, {
      notification: { id: 100, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    stubMpPayment({ status: 'rejected' });
    const late = await processMercadoPagoNativeWebhook(store, {
      notification: { id: 101, type: 'payment', data: { id: '555001' } },
      credentials,
      signatureVerified: true,
    });
    expect(late.httpStatus).toBe(200);
    const payment = await store.findPaymentById(paymentId);
    expect(payment!.status).toBe('SUCCEEDED');
  });

  it('verifyMercadoPagoWebhookSignature rejects missing signature', () => {
    expect(
      verifyMercadoPagoWebhookSignature({
        secret: MP_SECRET,
        dataId: '555',
        requestId: 'req',
        signatureHeader: undefined,
      }),
    ).toBe(false);
    const ts = '1700000000';
    const header = signMp('555', 'req', ts);
    expect(
      verifyMercadoPagoWebhookSignature({
        secret: MP_SECRET,
        dataId: '555',
        requestId: 'req',
        signatureHeader: header,
      }),
    ).toBe(true);
  });

  it('parseMercadoPagoNotification reads body and IPN query', () => {
    expect(
      parseMercadoPagoNotification({
        body: { type: 'payment', data: { id: '9' }, id: 1 },
      })?.data?.id,
    ).toBe('9');
    expect(
      parseMercadoPagoNotification({
        body: {},
        query: { topic: 'payment', id: '42' },
      })?.resourceId,
    ).toBe('42');
  });
});

describe('startStudentCheckout Mercado Pago', () => {
  const store = createInMemoryFinanceStore();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const actorUserId = randomUUID();
  let chargeId: string;

  beforeEach(async () => {
    store.clear();
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
      courseAmountMinor: 12500n,
      courseCurrency: 'ARS',
      studentEnrolled: true,
    });
    const charge = await store.createCharge({
      studentId,
      amountMinor: 12500n,
      currency: 'ARS',
      courseId,
      groupId,
      enrollmentId: null,
      classSessionId,
      periodStart: null,
      periodEnd: null,
      description: null,
      createdByUserId: actorUserId,
    });
    chargeId = charge.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not duplicate charges on checkout retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pref_retry',
          sandbox_init_point: 'https://sandbox.mercadopago.com/x',
          init_point: 'https://www.mercadopago.com/x',
        }),
      }),
    );
    const credentials = {
      mercadopagoAccessToken: MP_TOKEN,
      mercadopagoWebhookSecret: MP_SECRET,
      stripeSecretKey: '',
      stripeWebhookSecret: '',
      appPublicUrl: 'http://localhost:3000',
      apiPublicUrl: 'https://abc.ngrok-free.app',
    };
    const first = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
      credentials,
    });
    const second = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
      credentials,
    });
    expect(second.payment.id).toBe(first.payment.id);
    const charges = await store.listCharges({ studentId });
    expect(charges).toHaveLength(1);
    expect(first.checkoutUrl).toContain('sandbox.mercadopago.com');
  });

  it('resolvePaymentProvider stays stub without credentials', () => {
    expect(resolvePaymentProvider('MERCADOPAGO').name).toBe('MERCADOPAGO');
  });

  it('succeedPayment still creates a single ORIGINAL allocation (manual regression)', async () => {
    const payment = await createPayment(store, {
      chargeId,
      provider: 'MANUAL',
      idempotencyKey: `manual-${chargeId}`,
      createdByUserId: actorUserId,
    });
    await succeedPayment(store, payment.id);
    await expect(succeedPayment(store, payment.id)).rejects.toBeTruthy();
    const allocs = await store.listAllocations({ paymentId: payment.id });
    expect(allocs).toHaveLength(1);
  });
});
