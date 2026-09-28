import { describe, expect, it } from 'vitest';
import {
  buildStudentFinanceSummary,
  serializeStudentFinanceCharge,
  serializeStudentFinancePayment,
} from './student-finance-portal.js';
import type { ChargeRecord, PaymentRecord } from './finance-types.js';

function charge(
  overrides: Partial<ChargeRecord> & Pick<ChargeRecord, 'id' | 'status'>,
): ChargeRecord {
  const now = new Date('2026-09-20T12:00:00.000Z');
  return {
    studentId: '11111111-1111-4111-8111-111111111111',
    amountMinor: 12500n,
    currency: 'ARS',
    courseId: null,
    groupId: null,
    enrollmentId: null,
    classSessionId: null,
    description: 'Clase 1:1',
    createdByUserId: '22222222-2222-4222-8222-222222222222',
    periodStart: null,
    periodEnd: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function payment(
  overrides: Partial<PaymentRecord> & Pick<PaymentRecord, 'id' | 'status'>,
): PaymentRecord {
  const now = new Date('2026-09-20T13:00:00.000Z');
  return {
    studentId: '11111111-1111-4111-8111-111111111111',
    chargeId: '33333333-3333-4333-8333-333333333333',
    amountMinor: 12500n,
    currency: 'ARS',
    provider: 'MANUAL',
    providerPaymentId: null,
    idempotencyKey: 'key-1',
    createdByUserId: '22222222-2222-4222-8222-222222222222',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('student finance portal serializers', () => {
  it('omits admin fields from charge and payment DTOs', () => {
    const chargeDto = serializeStudentFinanceCharge(
      charge({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'OPEN' }),
    );
    expect(chargeDto).not.toHaveProperty('createdByUserId');
    expect(chargeDto).not.toHaveProperty('studentId');
    expect(chargeDto).not.toHaveProperty('academyPercentage');
    expect(chargeDto.amountMinor).toBe('12500');

    const paymentDto = serializeStudentFinancePayment(
      payment({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'SUCCEEDED' }),
    );
    expect(paymentDto).not.toHaveProperty('createdByUserId');
    expect(paymentDto).not.toHaveProperty('studentId');
    expect(paymentDto).not.toHaveProperty('idempotencyKey');
    expect(paymentDto).not.toHaveProperty('teacherId');
    expect(paymentDto.provider).toBe('MANUAL');
  });

  it('builds summary counts and open amounts by currency', () => {
    const summary = buildStudentFinanceSummary(
      [
        charge({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'OPEN' }),
        charge({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          status: 'OPEN',
          currency: 'USD',
          amountMinor: 2000n,
        }),
        charge({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status: 'PAID' }),
        charge({
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          status: 'CANCELLED',
        }),
      ],
      [
        payment({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          status: 'SUCCEEDED',
        }),
        payment({
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          status: 'PENDING',
          idempotencyKey: 'key-2',
        }),
      ],
    );
    expect(summary.openCharges).toBe(2);
    expect(summary.paidCharges).toBe(1);
    expect(summary.cancelledCharges).toBe(1);
    expect(summary.succeededPayments).toBe(1);
    expect(summary.openAmountByCurrency).toEqual(
      expect.arrayContaining([
        { currency: 'ARS', amountMinor: '12500' },
        { currency: 'USD', amountMinor: '2000' },
      ]),
    );
  });
});
