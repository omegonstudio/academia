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
import type {
  AcademyFinanceSettingsRecord,
  ChargeRecord,
  ClassSessionFinanceContext,
  EnrollmentFinanceContext,
  PaymentRecord,
  RefundRecord,
  RevenueAllocationRecord,
  TeacherSettlementRecord,
  WebhookEventRecord,
} from './finance-types.js';

export interface FinanceStore {
  runInTransaction<T>(fn: (tx: FinanceStore) => Promise<T>): Promise<T>;

  getFinanceSettings(): Promise<AcademyFinanceSettingsRecord | null>;
  upsertFinanceSettings(input: {
    academyPercentage: AcademyPercentage;
    updatedByUserId: string | null;
  }): Promise<AcademyFinanceSettingsRecord>;

  findChargeById(id: string): Promise<ChargeRecord | null>;
  findChargeByClassSessionId(
    classSessionId: string,
  ): Promise<ChargeRecord | null>;
  findChargeByEnrollmentPeriod(input: {
    enrollmentId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<ChargeRecord | null>;
  listCharges(filters: {
    studentId?: string;
    teacherId?: string;
    courseId?: string;
    classSessionId?: string;
    status?: ChargeStatus;
    currency?: FinanceCurrency;
  }): Promise<ChargeRecord[]>;
  /** Active enrollments on the ClassSession's group (for auto-charge). */
  listActiveEnrollmentsForClassSession(classSessionId: string): Promise<
    Array<{
      enrollmentId: string;
      studentId: string;
      serviceType: CourseServiceType;
    }>
  >;
  createCharge(input: {
    studentId: string;
    amountMinor: bigint;
    currency: FinanceCurrency;
    courseId: string | null;
    groupId: string | null;
    enrollmentId: string | null;
    classSessionId: string | null;
    description: string | null;
    createdByUserId: string;
    periodStart: Date | null;
    periodEnd: Date | null;
  }): Promise<ChargeRecord>;
  updateChargeStatus(
    id: string,
    status: ChargeStatus,
  ): Promise<ChargeRecord>;

  findPaymentById(id: string): Promise<PaymentRecord | null>;
  listPayments(filters: {
    studentId?: string;
    teacherId?: string;
    chargeId?: string;
    status?: PaymentStatus;
    currency?: FinanceCurrency;
    provider?: PaymentProvider;
  }): Promise<PaymentRecord[]>;
  findPaymentByIdempotencyKey(
    key: string,
  ): Promise<PaymentRecord | null>;
  findPaymentByProviderReference(
    provider: PaymentProvider,
    providerPaymentId: string,
  ): Promise<PaymentRecord | null>;
  findPaymentByChargeId(chargeId: string): Promise<PaymentRecord | null>;
  createPayment(input: {
    studentId: string;
    chargeId: string;
    amountMinor: bigint;
    currency: FinanceCurrency;
    provider: PaymentProvider;
    providerPaymentId: string | null;
    idempotencyKey: string;
    createdByUserId: string | null;
  }): Promise<PaymentRecord>;
  updatePaymentStatus(
    id: string,
    status: PaymentStatus,
  ): Promise<PaymentRecord>;

  findAllocationByPaymentAndKind(
    paymentId: string,
    kind: RevenueAllocationKind,
  ): Promise<RevenueAllocationRecord | null>;
  findAllocationById(id: string): Promise<RevenueAllocationRecord | null>;
  listAllocations(filters: {
    studentId?: string;
    teacherId?: string;
    paymentId?: string;
    chargeId?: string;
    kind?: RevenueAllocationKind;
    currency?: FinanceCurrency;
  }): Promise<RevenueAllocationRecord[]>;
  createAllocation(input: {
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
  }): Promise<RevenueAllocationRecord>;
  listAllocationsForTeacherPeriod(input: {
    teacherId: string;
    periodStart: Date;
    periodEnd: Date;
    currency?: FinanceCurrency;
  }): Promise<RevenueAllocationRecord[]>;

  findRefundByPaymentId(paymentId: string): Promise<RefundRecord | null>;
  createRefund(input: {
    paymentId: string;
    amountMinor: bigint;
    currency: FinanceCurrency;
    reason: string | null;
    createdByUserId: string | null;
  }): Promise<RefundRecord>;

  findSettlementById(id: string): Promise<TeacherSettlementRecord | null>;
  listSettlements(filters: {
    teacherId?: string;
    status?: TeacherSettlementStatus;
    currency?: FinanceCurrency;
  }): Promise<TeacherSettlementRecord[]>;
  findSettlementByKey(input: {
    teacherId: string;
    periodStart: Date;
    periodEnd: Date;
    currency: FinanceCurrency;
  }): Promise<TeacherSettlementRecord | null>;
  createSettlement(input: {
    teacherId: string;
    periodStart: Date;
    periodEnd: Date;
    totalTeacherAmountMinor: bigint;
    currency: FinanceCurrency;
    note: string | null;
  }): Promise<TeacherSettlementRecord>;
  markSettlementPaid(
    id: string,
    note: string | null,
  ): Promise<TeacherSettlementRecord>;

  createWebhookEvent(input: {
    provider: PaymentProvider;
    providerEventId: string;
    payload: unknown;
  }): Promise<WebhookEventRecord>;
  findWebhookEvent(
    provider: PaymentProvider,
    providerEventId: string,
  ): Promise<WebhookEventRecord | null>;
  markWebhookProcessed(
    id: string,
    input: { error: string | null },
  ): Promise<WebhookEventRecord>;

  loadClassSessionFinanceContext(input: {
    classSessionId: string;
    studentId: string;
  }): Promise<ClassSessionFinanceContext | null>;

  loadEnrollmentFinanceContext(
    enrollmentId: string,
  ): Promise<EnrollmentFinanceContext | null>;

  /** Resolve Group.teacherId for an existing charge's commercial context. */
  resolveTeacherIdForCharge(charge: ChargeRecord): Promise<string | null>;

  /** Optional test hook — called inside succeedPayment before allocation insert. */
  beforeCreateAllocationHook?: () => void | Promise<void>;
}
