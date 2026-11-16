import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import { getOrCreateFinanceSettings } from './finance-settings-service.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import { createInMemoryPaymentSubmissionStore } from './in-memory-payment-submission-store.js';
import {
  createPaymentSubmission,
  listStudentPaymentSubmissions,
  serializePaymentSubmission,
} from './payment-submission-service.js';
import { createPayment, succeedPayment } from './payment-service.js';

describe('payment-submission-service', () => {
  const finance = createInMemoryFinanceStore();
  const submissions = createInMemoryPaymentSubmissionStore();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const otherStudentId = randomUUID();
  const actorUserId = randomUUID();
  let chargeId: string;

  beforeEach(async () => {
    finance.clear();
    submissions.clear();
    await getOrCreateFinanceSettings(finance);
    const classSessionId = randomUUID();
    const courseId = randomUUID();
    const groupId = randomUUID();
    finance.seedClassSession({
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
    const charge = await finance.createCharge({
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

  it('creates SUBMITTED without Payment, Allocation, or Charge PAID', async () => {
    const created = await createPaymentSubmission(finance, submissions, {
      studentId,
      actorUserId,
      body: {
        chargeId,
        reportedAmountMinor: '12500',
        reportedCurrency: 'ARS',
        paidAt: '2026-11-16T15:00:00.000Z',
        studentNote: 'Transferencia bancaria',
      },
    });
    expect(created.status).toBe('SUBMITTED');
    expect(created.receiptStorageKey).toBeNull();
    const dto = serializePaymentSubmission(created);
    expect(dto.hasReceipt).toBe(false);
    expect(dto.reportedAmountMinor).toBe('12500');

    const charge = await finance.findChargeById(chargeId);
    expect(charge!.status).toBe('OPEN');
    expect(await finance.listPayments({ chargeId })).toHaveLength(0);
    expect(await finance.listAllocations({ chargeId })).toHaveLength(0);

    const events = await submissions.listEvents(created.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.toStatus).toBe('SUBMITTED');
  });

  it('lists only the owning student submissions and keeps history', async () => {
    const first = await createPaymentSubmission(finance, submissions, {
      studentId,
      actorUserId,
      body: {
        chargeId,
        reportedAmountMinor: '12500',
        reportedCurrency: 'ARS',
        paidAt: '2026-11-16T15:00:00.000Z',
      },
    });
    await submissions.update({
      id: first.id,
      status: 'REJECTED',
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    });
    const second = await createPaymentSubmission(finance, submissions, {
      studentId,
      actorUserId,
      body: {
        chargeId,
        reportedAmountMinor: '12500',
        reportedCurrency: 'ARS',
        paidAt: '2026-11-16T16:00:00.000Z',
      },
    });
    const mine = await listStudentPaymentSubmissions(submissions, {
      studentId,
    });
    expect(mine.map((row) => row.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    const foreign = await listStudentPaymentSubmissions(submissions, {
      studentId: otherStudentId,
    });
    expect(foreign).toHaveLength(0);
  });

  it('rejects foreign charge, non-OPEN charge, currency mismatch, and approved charge', async () => {
    await expect(
      createPaymentSubmission(finance, submissions, {
        studentId: otherStudentId,
        actorUserId,
        body: {
          chargeId,
          reportedAmountMinor: '12500',
          reportedCurrency: 'ARS',
          paidAt: '2026-11-16T15:00:00.000Z',
        },
      }),
    ).rejects.toBeInstanceOf(FinanceNotFoundError);

    await expect(
      createPaymentSubmission(finance, submissions, {
        studentId,
        actorUserId,
        body: {
          chargeId,
          reportedAmountMinor: '12500',
          reportedCurrency: 'USD',
          paidAt: '2026-11-16T15:00:00.000Z',
        },
      }),
    ).rejects.toBeInstanceOf(FinanceValidationError);

    const payment = await createPayment(finance, {
      chargeId,
      provider: 'MANUAL',
      idempotencyKey: `manual-${chargeId}`,
      createdByUserId: actorUserId,
    });
    await succeedPayment(finance, payment.id);

    await expect(
      createPaymentSubmission(finance, submissions, {
        studentId,
        actorUserId,
        body: {
          chargeId,
          reportedAmountMinor: '12500',
          reportedCurrency: 'ARS',
          paidAt: '2026-11-16T15:00:00.000Z',
        },
      }),
    ).rejects.toBeInstanceOf(FinanceValidationError);
  });

  it('blocks a second create after APPROVED', async () => {
    const created = await createPaymentSubmission(finance, submissions, {
      studentId,
      actorUserId,
      body: {
        chargeId,
        reportedAmountMinor: '12500',
        reportedCurrency: 'ARS',
        paidAt: '2026-11-16T15:00:00.000Z',
      },
    });
    await submissions.update({ id: created.id, status: 'APPROVED' });
    await expect(
      createPaymentSubmission(finance, submissions, {
        studentId,
        actorUserId,
        body: {
          chargeId,
          reportedAmountMinor: '12500',
          reportedCurrency: 'ARS',
          paidAt: '2026-11-16T17:00:00.000Z',
        },
      }),
    ).rejects.toBeInstanceOf(FinanceConflictError);
  });
});
