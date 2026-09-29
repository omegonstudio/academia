import {
  moneyMinorToString,
  teacherPercentageFromAcademy,
  type Charge,
  type Payment,
  type Refund,
  type RevenueAllocation,
  type TeacherSettlement,
} from '@academia/shared';
import type { AcademyFinanceSettingsView } from './finance-settings-service.js';
import type {
  ChargeRecord,
  PaymentRecord,
  RefundRecord,
  RevenueAllocationRecord,
  TeacherSettlementRecord,
} from './finance-types.js';

function iso(value: Date): string {
  return value.toISOString();
}

export function serializeFinanceSettings(view: AcademyFinanceSettingsView) {
  return {
    academyPercentage: view.academyPercentage,
    teacherPercentage: teacherPercentageFromAcademy(view.academyPercentage),
  };
}

export function serializeCharge(row: ChargeRecord): Charge {
  return {
    id: row.id,
    studentId: row.studentId,
    amountMinor: moneyMinorToString(row.amountMinor),
    currency: row.currency,
    status: row.status,
    courseId: row.courseId,
    groupId: row.groupId,
    enrollmentId: row.enrollmentId,
    classSessionId: row.classSessionId,
    description: row.description,
    createdByUserId: row.createdByUserId,
    periodStart: row.periodStart ? iso(row.periodStart) : null,
    periodEnd: row.periodEnd ? iso(row.periodEnd) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializePayment(row: PaymentRecord): Payment {
  return {
    id: row.id,
    studentId: row.studentId,
    chargeId: row.chargeId,
    amountMinor: moneyMinorToString(row.amountMinor),
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    providerPaymentId: row.providerPaymentId,
    idempotencyKey: row.idempotencyKey,
    createdByUserId: row.createdByUserId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeRefund(row: RefundRecord): Refund {
  return {
    id: row.id,
    paymentId: row.paymentId,
    amountMinor: moneyMinorToString(row.amountMinor),
    currency: row.currency,
    reason: row.reason,
    createdByUserId: row.createdByUserId,
    createdAt: iso(row.createdAt),
  };
}

export function serializeAllocation(
  row: RevenueAllocationRecord,
): RevenueAllocation {
  return {
    id: row.id,
    paymentId: row.paymentId,
    chargeId: row.chargeId,
    studentId: row.studentId,
    teacherId: row.teacherId,
    courseId: row.courseId,
    groupId: row.groupId,
    kind: row.kind,
    amountMinor: moneyMinorToString(row.amountMinor),
    currency: row.currency,
    academyPercentage: row.academyPercentage,
    academyAmountMinor: moneyMinorToString(row.academyAmountMinor),
    teacherAmountMinor: moneyMinorToString(row.teacherAmountMinor),
    refundId: row.refundId,
    createdAt: iso(row.createdAt),
  };
}

export function serializeSettlement(
  row: TeacherSettlementRecord,
): TeacherSettlement {
  return {
    id: row.id,
    teacherId: row.teacherId,
    periodStart: iso(row.periodStart),
    periodEnd: iso(row.periodEnd),
    totalTeacherAmountMinor: moneyMinorToString(row.totalTeacherAmountMinor),
    currency: row.currency,
    status: row.status,
    markedPaidAt: row.markedPaidAt ? iso(row.markedPaidAt) : null,
    note: row.note,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}
