import { describe, expect, it, vi } from 'vitest';
import { notifyPaymentSubmissionReceived } from './notification-hooks.js';
import type { NotificationPublisher } from './notification-types.js';

describe('notifyPaymentSubmissionReceived', () => {
  it('notifies staff without attaching files or public storage keys', async () => {
    const notifyMany = vi.fn(async () => undefined);
    const publisher = { notifyMany, notify: vi.fn() } as NotificationPublisher;
    await notifyPaymentSubmissionReceived(publisher, {
      recipients: [
        { userId: 'u1', email: 'dir@academia.test', displayName: 'Dir' },
      ],
      studentName: 'Ana Pérez',
      chargeId: 'charge-1',
      submissionId: 'sub-1',
      reportedAmountLabel: '12500 ARS',
      paidAtIso: '2026-11-16T15:00:00.000Z',
      reviewPath: 'http://localhost:3000/dashboard/finance/submissions',
    });
    expect(notifyMany).toHaveBeenCalledOnce();
    const call = notifyMany.mock.calls[0];
    expect(call).toBeDefined();
    const inputs = call![0] as Array<{
      type: string;
      body: string;
      payload: Record<string, unknown>;
    }>;
    expect(inputs[0]!.type).toBe('PAYMENT_SUBMISSION_RECEIVED');
    expect(inputs[0]!.body).toContain('Ana Pérez');
    expect(inputs[0]!.body).toContain('/dashboard/finance/submissions');
    expect(JSON.stringify(inputs[0]!.payload)).not.toMatch(/receipts\//);
    expect(JSON.stringify(inputs[0]!.payload)).not.toMatch(/storageKey/);
  });

  it('no-ops without publisher or recipients', async () => {
    await expect(
      notifyPaymentSubmissionReceived(undefined, {
        recipients: [],
        studentName: 'x',
        chargeId: 'c',
        submissionId: 's',
        reportedAmountLabel: '1',
        paidAtIso: '2026-11-16T15:00:00.000Z',
        reviewPath: '/dashboard/finance/submissions',
      }),
    ).resolves.toBeUndefined();
  });
});
