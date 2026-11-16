import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
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
    const { payment } = await startStudentCheckout(store, {
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
    const { payment: first, checkoutUrl: firstUrl } = await startStudentCheckout(
      store,
      {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      },
    );
    const { payment: second, checkoutUrl: secondUrl } =
      await startStudentCheckout(store, {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      });
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('PENDING');
    // Stub adapters have no hosted URL — resume must still be safe.
    expect(firstUrl).toBeNull();
    expect(secondUrl).toBeNull();
    const all = await store.listPayments({ studentId });
    expect(all).toHaveLength(1);
    const charge = await store.findChargeById(chargeId);
    expect(charge!.status).toBe('OPEN');
  });

  it('resumes PENDING without creating a second Payment (repeated request)', async () => {
    const first = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
    });
    const parallel = await Promise.all([
      startStudentCheckout(store, {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      }),
      startStudentCheckout(store, {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      }),
    ]);
    expect(parallel[0]!.payment.id).toBe(first.payment.id);
    expect(parallel[1]!.payment.id).toBe(first.payment.id);
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

  it('retries after FAILED with a new Payment and keeps history', async () => {
    const first = await createPayment(store, {
      chargeId,
      provider: 'MERCADOPAGO',
      idempotencyKey: `mp-${chargeId}`,
      createdByUserId: actorUserId,
    });
    await store.updatePaymentStatus(first.id, 'FAILED');
    const retry = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
    });
    expect(retry.payment.id).not.toBe(first.id);
    expect(retry.payment.status).toBe('PENDING');
    expect(retry.payment.idempotencyKey).toContain(`retry:${first.id}`);
    const all = await store.listPayments({ chargeId });
    expect(all).toHaveLength(2);
    expect(all.some((row) => row.id === first.id && row.status === 'FAILED')).toBe(
      true,
    );
    const charge = await store.findChargeById(chargeId);
    expect(charge!.status).toBe('OPEN');
  });

  it('retries after CANCELLED and collapses concurrent retries on same key', async () => {
    const first = await createPayment(store, {
      chargeId,
      provider: 'MERCADOPAGO',
      idempotencyKey: `mp-cancel-${chargeId}`,
      createdByUserId: actorUserId,
    });
    await store.updatePaymentStatus(first.id, 'CANCELLED');
    const [a, b] = await Promise.all([
      startStudentCheckout(store, {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      }),
      startStudentCheckout(store, {
        studentId,
        chargeId,
        createdByUserId: actorUserId,
      }),
    ]);
    expect(a.payment.id).toBe(b.payment.id);
    const live = (await store.listPayments({ chargeId })).filter(
      (row) => row.status === 'PENDING' || row.status === 'SUCCEEDED',
    );
    expect(live).toHaveLength(1);
  });

  it('late succeed of older FAILED cancels newer PENDING and pays once', async () => {
    const first = await createPayment(store, {
      chargeId,
      provider: 'MERCADOPAGO',
      idempotencyKey: `mp-late-${chargeId}`,
      providerPaymentId: 'pref_old',
      createdByUserId: actorUserId,
    });
    await store.updatePaymentStatus(first.id, 'FAILED');
    const retry = await startStudentCheckout(store, {
      studentId,
      chargeId,
      createdByUserId: actorUserId,
    });
    expect(retry.payment.status).toBe('PENDING');
    const result = await succeedPayment(store, first.id);
    expect(result.payment.status).toBe('SUCCEEDED');
    expect(result.charge.status).toBe('PAID');
    const newer = await store.findPaymentById(retry.payment.id);
    expect(newer!.status).toBe('CANCELLED');
    const allocs = await store.listAllocations({ chargeId });
    expect(allocs.filter((row) => row.kind === 'ORIGINAL')).toHaveLength(1);
  });

  it('webhook succeed after checkout creates allocation', async () => {
    const { payment } = await startStudentCheckout(store, {
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
    const { payment } = await startStudentCheckout(store, {
      studentId,
      chargeId: usdCharge.id,
      createdByUserId: actorUserId,
    });
    expect(payment.provider).toBe('STRIPE');
    expect(payment.providerPaymentId).toMatch(/^stripe_stub_/);
  });
});
