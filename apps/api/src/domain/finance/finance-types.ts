import type {
  AcademyPercentage,
  ChargeStatus,
  CourseServiceType,
  FinanceCurrency,
  PaymentProvider,
  PaymentStatus,
  RevenueAllocationKind,
  TeacherSettlementStatus,
} from '@academia/shared';

export interface AcademyFinanceSettingsRecord {
  id: string;
  academyPercentage: AcademyPercentage;
  updatedAt: Date;
  updatedByUserId: string | null;
}

export interface ChargeRecord {
  id: string;
  studentId: string;
  amountMinor: bigint;
  currency: FinanceCurrency;
  status: ChargeStatus;
  courseId: string | null;
  groupId: string | null;
  enrollmentId: string | null;
  classSessionId: string | null;
  description: string | null;
  createdByUserId: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRecord {
  id: string;
  studentId: string;
  chargeId: string;
  amountMinor: bigint;
  currency: FinanceCurrency;
  status: PaymentStatus;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  idempotencyKey: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueAllocationRecord {
  id: string;
  paymentId: string;
  chargeId: string;
  studentId: string;
  teacherId: string;
  courseId: string | null;
  groupId: string | null;
  kind: RevenueAllocationKind;
  amountMinor: bigint;
  currency: FinanceCurrency;
  academyPercentage: AcademyPercentage;
  academyAmountMinor: bigint;
  teacherAmountMinor: bigint;
  refundId: string | null;
  createdAt: Date;
}

export interface RefundRecord {
  id: string;
  paymentId: string;
  amountMinor: bigint;
  currency: FinanceCurrency;
  reason: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

export interface TeacherSettlementRecord {
  id: string;
  teacherId: string;
  periodStart: Date;
  periodEnd: Date;
  totalTeacherAmountMinor: bigint;
  currency: FinanceCurrency;
  status: TeacherSettlementStatus;
  markedPaidAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEventRecord {
  id: string;
  provider: PaymentProvider;
  providerEventId: string;
  payload: unknown;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

/** Academic snapshot used to validate Charge creation / resolve teacher. */
export interface ClassSessionFinanceContext {
  classSessionId: string;
  groupId: string;
  courseId: string;
  serviceType: CourseServiceType;
  teacherId: string | null;
  courseAmountMinor: bigint | null;
  courseCurrency: FinanceCurrency | null;
  studentEnrolled: boolean;
}

export interface EnrollmentFinanceContext {
  enrollmentId: string;
  studentId: string;
  groupId: string;
  courseId: string;
  serviceType: CourseServiceType;
  teacherId: string | null;
  courseAmountMinor: bigint | null;
  courseCurrency: FinanceCurrency | null;
}
