import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FinanceConflictError,
  FinanceValidationError,
} from './finance-errors.js';
import { getOrCreateFinanceSettings } from './finance-settings-service.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import { createInMemoryPaymentSubmissionStore } from './in-memory-payment-submission-store.js';
import { createPayment } from './payment-service.js';
import { createPaymentSubmission } from './payment-submission-service.js';
import { approvePaymentSubmission } from './payment-submission-approve-service.js';

describe('approvePaymentSubmission', () => {
  const finance = createInMemoryFinanceStore();
  const submissions = createInMemoryPaymentSubmissionStore();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const actorUserId = randomUUID();
  let chargeId: string;
  let submissionId: string;

  async function seedCharge(amountMinor: bigint): Promise<string> {
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
      courseAmountMinor: amountMinor,
      courseCurrency: 'ARS',
      studentEnrolled: true,
    });
    const charge = await finance.createCharge({
      studentId,
      amountMinor,
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
    return charge.id;
  }

  beforeEach(async () => {
    finance.clear();
    submissions.clear();
    await getOrCreateFinanceSettings(finance);
    chargeId = await seedCharge(12500n);
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
    await submissions.update({
      id: created.id,
      receiptStorageKey: `receipts/2026/11/${created.id}/file`,
      receiptFilename: 'comprobante.pdf',
      receiptMimeType: 'application/pdf',
      receiptSizeBytes: 1200,
    });
    submissionId = created.id;
  });

  it('approves into MANUAL SUCCEEDED + Charge PAID + single ORIGINAL allocation', async () => {
    const pending = await createPayment(finance, {
      chargeId,
      provider: 'MERCADOPAGO',
      idempotencyKey: `mp-${chargeId}`,
      createdByUserId: actorUserId,
    });
    expect(pending.status).toBe('PENDING');

    const approved = await approvePaymentSubmission(finance, submissions, {
      submissionId,
      actorUserId,
      body: { moneyReceivedConfirmed: true, adminNote: 'Transferencia OK' },
    });
    expect(approved.status).toBe('APPROVED');
    expect(approved.chargeStatus).toBe('PAID');

    const charge = await finance.findChargeById(chargeId);
    expect(charge!.status).toBe('PAID');
    const payments = await finance.listPayments({ chargeId });
    const succeeded = payments.filter((row) => row.status === 'SUCCEEDED');
    expect(succeeded).toHaveLength(1);
    expect(succeeded[0]!.provider).toBe('MANUAL');
    expect(payments.find((row) => row.id === pending.id)!.status).toBe(
      'CANCELLED',
    );
    const allocs = await finance.listAllocations({ chargeId });
    expect(allocs.filter((row) => row.kind === 'ORIGINAL')).toHaveLength(1);

    const again = await approvePaymentSubmission(finance, submissions, {
      submissionId,
      actorUserId,
      body: { moneyReceivedConfirmed: true },
    });
    expect(again.status).toBe('APPROVED');
    expect(
      (await finance.listAllocations({ chargeId })).filter(
        (row) => row.kind === 'ORIGINAL',
      ),
    ).toHaveLength(1);
  });

  it('rejects mismatched amount and REJECTED submissions', async () => {
    const otherChargeId = await seedCharge(10000n);
    const wrong = await createPaymentSubmission(finance, submissions, {
      studentId,
      actorUserId,
      body: {
        chargeId: otherChargeId,
        reportedAmountMinor: '9000',
        reportedCurrency: 'ARS',
        paidAt: '2026-11-16T16:00:00.000Z',
      },
    });
    await submissions.update({
      id: wrong.id,
      receiptStorageKey: `receipts/2026/11/${wrong.id}/file`,
      receiptFilename: 'x.pdf',
      receiptMimeType: 'application/pdf',
      receiptSizeBytes: 10,
    });
    await expect(
      approvePaymentSubmission(finance, submissions, {
        submissionId: wrong.id,
        actorUserId,
        body: { moneyReceivedConfirmed: true },
      }),
    ).rejects.toBeInstanceOf(FinanceValidationError);

    await submissions.update({ id: submissionId, status: 'REJECTED' });
    await expect(
      approvePaymentSubmission(finance, submissions, {
        submissionId,
        actorUserId,
        body: { moneyReceivedConfirmed: true },
      }),
    ).rejects.toBeInstanceOf(FinanceConflictError);
  });
});
