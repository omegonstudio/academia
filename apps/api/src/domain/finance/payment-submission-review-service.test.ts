import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FinanceConflictError,
  FinanceValidationError,
} from './finance-errors.js';
import { getOrCreateFinanceSettings } from './finance-settings-service.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import { createInMemoryPaymentSubmissionStore } from './in-memory-payment-submission-store.js';
import { createPaymentSubmission } from './payment-submission-service.js';
import {
  listAdminPaymentSubmissions,
  reviewPaymentSubmission,
} from './payment-submission-review-service.js';

describe('payment-submission-review-service', () => {
  const finance = createInMemoryFinanceStore();
  const submissions = createInMemoryPaymentSubmissionStore();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const actorUserId = randomUUID();
  let chargeId: string;
  let submissionId: string;

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
    const created = await createPaymentSubmission(finance, submissions, {
      studentId,
      actorUserId,
      body: {
        chargeId,
        reportedAmountMinor: '12000',
        reportedCurrency: 'ARS',
        paidAt: '2026-11-16T15:00:00.000Z',
      },
    });
    submissionId = created.id;
  });

  it('lists with amount delta and supports under review / correction / reject', async () => {
    const listed = await listAdminPaymentSubmissions(finance, submissions, {
      limit: 20,
      offset: 0,
    });
    expect(listed.total).toBe(1);
    expect(listed.submissions[0]!.amountMatchesCharge).toBe(false);
    expect(listed.submissions[0]!.amountDeltaMinor).toBe('-500');

    const under = await reviewPaymentSubmission(submissions, {
      submissionId,
      actorUserId,
      body: { action: 'take_under_review' },
    });
    expect(under.status).toBe('UNDER_REVIEW');

    const correction = await reviewPaymentSubmission(submissions, {
      submissionId,
      actorUserId,
      body: {
        action: 'request_correction',
        adminNote: 'Falta el comprobante legible',
      },
    });
    expect(correction.status).toBe('NEEDS_CORRECTION');

    const resent = await createPaymentSubmission(finance, submissions, {
      studentId,
      actorUserId,
      body: {
        chargeId,
        reportedAmountMinor: '12500',
        reportedCurrency: 'ARS',
        paidAt: '2026-11-16T18:00:00.000Z',
      },
    });
    const rejected = await reviewPaymentSubmission(submissions, {
      submissionId: resent.id,
      actorUserId,
      body: { action: 'reject', adminNote: 'Monto incorrecto' },
    });
    expect(rejected.status).toBe('REJECTED');

    const events = await submissions.listEvents(submissionId);
    expect(events.length).toBeGreaterThanOrEqual(3);
  });

  it('requires adminNote for reject and blocks review of APPROVED', async () => {
    await expect(
      reviewPaymentSubmission(submissions, {
        submissionId,
        actorUserId,
        body: { action: 'reject' },
      }),
    ).rejects.toBeInstanceOf(FinanceValidationError);

    await submissions.update({ id: submissionId, status: 'APPROVED' });
    await expect(
      reviewPaymentSubmission(submissions, {
        submissionId,
        actorUserId,
        body: { action: 'take_under_review' },
      }),
    ).rejects.toBeInstanceOf(FinanceConflictError);
  });
});
