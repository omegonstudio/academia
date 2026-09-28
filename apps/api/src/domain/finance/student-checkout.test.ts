import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import { getOrCreateFinanceSettings } from './finance-settings-service.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import { createPayment, succeedPayment } from './payment-service.js';
import { processProviderWebhook } from './webhook-service.js';
import { startStudentCheckout } from './student-checkout.js';

describe('startStudentCheckout', () => {
  const store = createInMemoryFinanceStore();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const otherStudentId = randomUUID();
  const actorUserId = randomUUID();
  let classSessionId: string;
  let chargeId: string;

  beforeEach(async () => {
    store.clear();
    await getOrCreateFinanceSettings(store);
    classSessionId = randomUUID();
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
      description: 'Test charge',
      createdByUserId: actorUserId,
    });
    chargeId = charge.id;
  });

  it('creates PENDING Payment with currency-routed provider (ARS→MP)', async () => {
    const payment = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
    });
    expect(payment.status).toBe('PENDING');
    expect(payment.provider).toBe('MERCADOPAGO');
    expect(payment.chargeId).toBe(chargeId);
    expect(payment.providerPaymentId).toMatch(/^mp_stub_/);

    const charge = await store.findChargeById(chargeId);
    expect(charge!.status).toBe('OPEN');
    const allocs = await store.listAllocations({ paymentId: payment.id });
    expect(allocs).toHaveLength(0);
  });

  it('is idempotent on double checkout (same PENDING Payment)', async () => {
    const first = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
    });
    const second = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
    });
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('PENDING');
    const all = await store.listPayments({ studentId });
    expect(all).toHaveLength(1);
  });

  it('rejects foreign Charge (ownership)', async () => {
    await expect(
      startStudentCheckout(store, {
        studentId: otherStudentId,
        chargeId,
        createdByUserId: actorUserId,
      }),
    ).rejects.toBeInstanceOf(FinanceNotFoundError);
  });

  it('rejects non-OPEN Charge', async () => {
    await store.updateChargeStatus(chargeId, 'CANCELLED');
    await expect(
      startStudentCheckout(store, {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      }),
    ).rejects.toBeInstanceOf(FinanceValidationError);
  });

  it('rejects restart when Charge is already PAID', async () => {
    const payment = await createPayment(store, {
      chargeId,
      provider: 'MANUAL',
      idempotencyKey: `manual-${chargeId}`,
      createdByUserId: actorUserId,
    });
    await succeedPayment(store, payment.id);
    // Charge is PAID → OPEN guard fires before Payment conflict.
    await expect(
      startStudentCheckout(store, {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      }),
    ).rejects.toBeInstanceOf(FinanceValidationError);
  });

  it('rejects restart when PENDING Payment was cancelled (non-PENDING exists)', async () => {
    const payment = await createPayment(store, {
      chargeId,
      provider: 'MERCADOPAGO',
      idempotencyKey: `mp-${chargeId}`,
      createdByUserId: actorUserId,
    });
    await store.updatePaymentStatus(payment.id, 'FAILED');
    await expect(
      startStudentCheckout(store, {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      }),
    ).rejects.toBeInstanceOf(FinanceConflictError);
  });

  it('webhook succeed after checkout creates allocation', async () => {
    const payment = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
    });
    await processProviderWebhook(store, {
      provider: 'MERCADOPAGO',
      providerEventId: `evt_${randomUUID()}`,
      type: 'payment.succeeded',
      paymentId: payment.id,
      payload: null,
    });
    const updated = await store.findPaymentById(payment.id);
    expect(updated!.status).toBe('SUCCEEDED');
    const charge = await store.findChargeById(chargeId);
    expect(charge!.status).toBe('PAID');
    const allocs = await store.listAllocations({ paymentId: payment.id });
    expect(allocs).toHaveLength(1);
    expect(allocs[0]!.kind).toBe('ORIGINAL');
  });

  it('routes USD to STRIPE stub (never MANUAL)', async () => {
    const usdSession = randomUUID();
    const courseId = randomUUID();
    const groupId = randomUUID();
    store.seedClassSession({
      classSessionId: usdSession,
      studentId,
      groupId,
      courseId,
      serviceType: 'ONE_TO_ONE_60',
      teacherId,
      courseAmountMinor: 5000n,
      courseCurrency: 'USD',
      studentEnrolled: true,
    });
    const usdCharge = await store.createCharge({
      studentId,
      amountMinor: 5000n,
      currency: 'USD',
      courseId,
      groupId,
      enrollmentId: null,
      classSessionId: usdSession,
      periodStart: null,
      periodEnd: null,
      description: null,
      createdByUserId: actorUserId,
    });
    const payment = await startStudentCheckout(store, {
      studentId,
      chargeId: usdCharge.id,
      createdByUserId: actorUserId,
    });
    expect(payment.provider).toBe('STRIPE');
    expect(payment.providerPaymentId).toMatch(/^stripe_stub_/);
  });
});
