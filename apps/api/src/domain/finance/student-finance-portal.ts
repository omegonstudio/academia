import {
  moneyMinorToString,
  type StudentFinanceCharge,
  type StudentFinancePayment,
  type StudentFinanceRefund,
  type StudentFinanceResponse,
  type StudentFinanceSummary,
} from '@academia/shared';
import type { FinanceStore } from './finance-store.js';
import type {
  ChargeRecord,
  PaymentRecord,
  RefundRecord,
} from './finance-types.js';

function iso(value: Date): string {
  return value.toISOString();
}

export function serializeStudentFinanceCharge(
  row: ChargeRecord,
): StudentFinanceCharge {
  return {
    id: row.id,
    amountMinor: moneyMinorToString(row.amountMinor),
    currency: row.currency,
    status: row.status,
    description: row.description,
    courseId: row.courseId,
    groupId: row.groupId,
    enrollmentId: row.enrollmentId,
    classSessionId: row.classSessionId,
    periodStart: row.periodStart ? iso(row.periodStart) : null,
    periodEnd: row.periodEnd ? iso(row.periodEnd) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeStudentFinancePayment(
  row: PaymentRecord,
): StudentFinancePayment {
  return {
    id: row.id,
    chargeId: row.chargeId,
    amountMinor: moneyMinorToString(row.amountMinor),
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    providerPaymentId: row.providerPaymentId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeStudentFinanceRefund(
  row: RefundRecord,
): StudentFinanceRefund {
  return {
    id: row.id,
    paymentId: row.paymentId,
    amountMinor: moneyMinorToString(row.amountMinor),
    currency: row.currency,
    createdAt: iso(row.createdAt),
  };
}

export function buildStudentFinanceSummary(
  charges: readonly ChargeRecord[],
  payments: readonly PaymentRecord[],
): StudentFinanceSummary {
  let openCharges = 0;
  let paidCharges = 0;
  let cancelledCharges = 0;
  const openByCurrency = new Map<string, bigint>();

  for (const charge of charges) {
    if (charge.status === 'OPEN') {
      openCharges += 1;
      const prev = openByCurrency.get(charge.currency) ?? 0n;
      openByCurrency.set(charge.currency, prev + charge.amountMinor);
    } else if (charge.status === 'PAID') {
      paidCharges += 1;
    } else if (charge.status === 'CANCELLED') {
      cancelledCharges += 1;
    }
  }

  const succeededPayments = payments.filter(
    (payment) => payment.status === 'SUCCEEDED',
  ).length;

  return {
    openCharges,
    paidCharges,
    cancelledCharges,
    succeededPayments,
    openAmountByCurrency: [...openByCurrency.entries()].map(
      ([currency, amountMinor]) => ({
        currency: currency as StudentFinanceSummary['openAmountByCurrency'][number]['currency'],
        amountMinor: moneyMinorToString(amountMinor),
      }),
    ),
  };
}

/**
 * Read-only finance portal for one student.
 * Caller must resolve studentId from the session — never from the client.
 */
export async function getStudentFinancePortal(
  store: FinanceStore,
  studentId: string,
): Promise<StudentFinanceResponse> {
  const [charges, payments] = await Promise.all([
    store.listCharges({ studentId }),
    store.listPayments({ studentId }),
  ]);

  const refunds: StudentFinanceRefund[] = [];
  for (const payment of payments) {
    const refund = await store.findRefundByPaymentId(payment.id);
    if (refund) {
      refunds.push(serializeStudentFinanceRefund(refund));
    }
  }

  charges.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  refunds.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    summary: buildStudentFinanceSummary(charges, payments),
    charges: charges.map(serializeStudentFinanceCharge),
    payments: payments.map(serializeStudentFinancePayment),
    refunds,
  };
}
