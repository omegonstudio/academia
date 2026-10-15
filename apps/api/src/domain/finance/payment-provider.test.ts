import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  resolvePaymentProvider,
  verifyMercadoPagoWebhookSignature,
  verifyStripeWebhookSignature,
} from './payment-provider.js';

describe('resolvePaymentProvider', () => {
  it('uses stubs when credentials are empty', () => {
    expect(resolvePaymentProvider('MERCADOPAGO').name).toBe('MERCADOPAGO');
    expect(resolvePaymentProvider('STRIPE').name).toBe('STRIPE');
  });

  it('returns MANUAL always', () => {
    expect(resolvePaymentProvider('MANUAL').name).toBe('MANUAL');
  });

  it('creates stub checkout refs offline', async () => {
    const ref = await resolvePaymentProvider('MERCADOPAGO').createPayment({
      amountMinor: 1000n,
      currency: 'ARS',
      chargeId: '00000000-0000-4000-8000-000000000001',
      studentId: '00000000-0000-4000-8000-000000000002',
      idempotencyKey: 'k1',
    });
    expect(ref.providerPaymentId).toMatch(/^mp_stub_/);
  });
});

describe('webhook signatures', () => {
  it('verifies a Stripe v1 signature', () => {
    const secret = 'whsec_test';
    const rawBody = '{"id":"evt_1"}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const v1 = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    expect(
      verifyStripeWebhookSignature(
        rawBody,
        `t=${timestamp},v1=${v1}`,
        secret,
      ),
    ).toBe(true);
    expect(
      verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=dead`, secret),
    ).toBe(false);
  });

  it('verifies a Mercado Pago x-signature', () => {
    const secret = 'mp_whsec';
    const dataId = '123';
    const requestId = 'req-1';
    const ts = '1700000000';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
    expect(
      verifyMercadoPagoWebhookSignature({
        secret,
        dataId,
        requestId,
        signatureHeader: `ts=${ts},v1=${v1}`,
      }),
    ).toBe(true);
  });
});
