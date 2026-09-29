import { z } from 'zod';

/** Allowed academy revenue-split percentages (#41 / #44). */
export const ACADEMY_PERCENTAGES = [20, 30, 40, 50] as const;
export type AcademyPercentage = (typeof ACADEMY_PERCENTAGES)[number];
export const DEFAULT_ACADEMY_PERCENTAGE: AcademyPercentage = 40;

export const academyPercentageSchema = z.union([
  z.literal(20),
  z.literal(30),
  z.literal(40),
  z.literal(50),
]);

export function isAcademyPercentage(value: number): value is AcademyPercentage {
  return (ACADEMY_PERCENTAGES as readonly number[]).includes(value);
}

export function teacherPercentageFromAcademy(
  academyPercentage: AcademyPercentage,
): number {
  return 100 - academyPercentage;
}

/**
 * Integer minor-unit split (#44). Never use floating point.
 * academy gets floor; teacher gets the remainder so amounts sum to total.
 */
export function splitAmountMinor(
  amountMinor: bigint,
  academyPercentage: AcademyPercentage,
): { academyAmountMinor: bigint; teacherAmountMinor: bigint } {
  if (amountMinor < 0n) {
    throw new Error('amountMinor must be non-negative for split.');
  }
  const academyAmountMinor =
    (amountMinor * BigInt(academyPercentage)) / 100n;
  const teacherAmountMinor = amountMinor - academyAmountMinor;
  return { academyAmountMinor, teacherAmountMinor };
}

export const FINANCE_CURRENCIES = ['ARS', 'USD'] as const;
export type FinanceCurrency = (typeof FINANCE_CURRENCIES)[number];
export const financeCurrencySchema = z.enum(FINANCE_CURRENCIES);

export function isFinanceCurrency(value: string): value is FinanceCurrency {
  return (FINANCE_CURRENCIES as readonly string[]).includes(value);
}

/** Provider routing (#44): ARS→MP, USD→Stripe. MANUAL is admin-only. */
export const PAYMENT_PROVIDERS = ['MERCADOPAGO', 'STRIPE', 'MANUAL'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS);

export function providerForCurrency(
  currency: FinanceCurrency,
): Exclude<PaymentProvider, 'MANUAL'> {
  return currency === 'ARS' ? 'MERCADOPAGO' : 'STRIPE';
}

/** Invalid MVP routings: ARS→Stripe, USD→Mercado Pago. */
export function isValidProviderCurrencyPair(
  provider: PaymentProvider,
  currency: FinanceCurrency,
): boolean {
  if (provider === 'MANUAL') return true;
  return providerForCurrency(currency) === provider;
}

export const CHARGE_STATUSES = ['OPEN', 'PAID', 'CANCELLED'] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];
export const chargeStatusSchema = z.enum(CHARGE_STATUSES);

export const PAYMENT_STATUSES = [
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

export const REVENUE_ALLOCATION_KINDS = ['ORIGINAL', 'REVERSAL'] as const;
export type RevenueAllocationKind = (typeof REVENUE_ALLOCATION_KINDS)[number];
export const revenueAllocationKindSchema = z.enum(REVENUE_ALLOCATION_KINDS);

export const TEACHER_SETTLEMENT_STATUSES = ['OPEN', 'MARKED_PAID'] as const;
export type TeacherSettlementStatus =
  (typeof TEACHER_SETTLEMENT_STATUSES)[number];
export const teacherSettlementStatusSchema = z.enum(
  TEACHER_SETTLEMENT_STATUSES,
);

/**
 * Serialize bigint money for JSON / shared DTOs (exact decimal string of minor units).
 */
export function moneyMinorToString(value: bigint): string {
  return value.toString(10);
}

export function parseMoneyMinor(raw: string | number | bigint): bigint {
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) {
      throw new Error('money minor units must be an integer.');
    }
    return BigInt(raw);
  }
  if (!/^-?\d+$/.test(raw)) {
    throw new Error('money minor units must be an integer string.');
  }
  return BigInt(raw);
}

export const moneyMinorStringSchema = z
  .string()
  .regex(/^-?\d+$/, 'money minor units must be an integer string');

export const nonNegativeMoneyMinorStringSchema = z
  .string()
  .regex(/^\d+$/, 'money minor units must be a non-negative integer string');

// ---------------------------------------------------------------------------
// HTTP DTOs (Stage 6B-2)
// ---------------------------------------------------------------------------

export const financeSettingsSchema = z.object({
  academyPercentage: academyPercentageSchema,
  teacherPercentage: z.number().int().positive(),
});

export type FinanceSettings = z.infer<typeof financeSettingsSchema>;

export const financeSettingsResponseSchema = z.object({
  settings: financeSettingsSchema,
});

export type FinanceSettingsResponse = z.infer<
  typeof financeSettingsResponseSchema
>;

export const updateFinanceSettingsRequestSchema = z.object({
  academyPercentage: academyPercentageSchema,
});

export type UpdateFinanceSettingsRequest = z.infer<
  typeof updateFinanceSettingsRequestSchema
>;

export const chargeSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  amountMinor: nonNegativeMoneyMinorStringSchema,
  currency: financeCurrencySchema,
  status: chargeStatusSchema,
  courseId: z.string().uuid().nullable(),
  groupId: z.string().uuid().nullable(),
  enrollmentId: z.string().uuid().nullable(),
  classSessionId: z.string().uuid().nullable(),
  description: z.string().nullable(),
  createdByUserId: z.string().uuid(),
  periodStart: z.string().datetime().nullable(),
  periodEnd: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Charge = z.infer<typeof chargeSchema>;

export const chargeListResponseSchema = z.object({
  charges: z.array(chargeSchema),
});

export type ChargeListResponse = z.infer<typeof chargeListResponseSchema>;

export const chargeResponseSchema = z.object({
  charge: chargeSchema,
});

export type ChargeResponse = z.infer<typeof chargeResponseSchema>;

/** Create Charge from commercial unit (#44). */
export const createChargeRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('CLASS_SESSION'),
    classSessionId: z.string().uuid(),
    studentId: z.string().uuid(),
    description: z.string().trim().max(500).optional(),
  }),
  z.object({
    kind: z.literal('ENROLLMENT_PERIOD'),
    enrollmentId: z.string().uuid(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    description: z.string().trim().max(500).optional(),
  }),
]);

export type CreateChargeRequest = z.infer<typeof createChargeRequestSchema>;

export const chargeListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  classSessionId: z.string().uuid().optional(),
  status: chargeStatusSchema.optional(),
  currency: financeCurrencySchema.optional(),
});

export type ChargeListQuery = z.infer<typeof chargeListQuerySchema>;

export const paymentSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  chargeId: z.string().uuid(),
  amountMinor: nonNegativeMoneyMinorStringSchema,
  currency: financeCurrencySchema,
  status: paymentStatusSchema,
  provider: paymentProviderSchema,
  providerPaymentId: z.string().nullable(),
  idempotencyKey: z.string().min(1).max(191),
  createdByUserId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Payment = z.infer<typeof paymentSchema>;

export const paymentListResponseSchema = z.object({
  payments: z.array(paymentSchema),
});

export type PaymentListResponse = z.infer<typeof paymentListResponseSchema>;

export const paymentResponseSchema = z.object({
  payment: paymentSchema,
});

export type PaymentResponse = z.infer<typeof paymentResponseSchema>;

export const createPaymentRequestSchema = z.object({
  chargeId: z.string().uuid(),
  provider: paymentProviderSchema,
  idempotencyKey: z.string().trim().min(1).max(191),
  providerPaymentId: z.string().trim().min(1).max(191).optional(),
});

export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;

export const paymentListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  chargeId: z.string().uuid().optional(),
  status: paymentStatusSchema.optional(),
  currency: financeCurrencySchema.optional(),
  provider: paymentProviderSchema.optional(),
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export const createRefundRequestSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export type CreateRefundRequest = z.infer<typeof createRefundRequestSchema>;

export const refundSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  amountMinor: nonNegativeMoneyMinorStringSchema,
  currency: financeCurrencySchema,
  reason: z.string().nullable(),
  createdByUserId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export type Refund = z.infer<typeof refundSchema>;

export const refundResponseSchema = z.object({
  refund: refundSchema,
  payment: paymentSchema,
});

export type RefundResponse = z.infer<typeof refundResponseSchema>;

export const revenueAllocationSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  chargeId: z.string().uuid(),
  studentId: z.string().uuid(),
  teacherId: z.string().uuid(),
  courseId: z.string().uuid().nullable(),
  groupId: z.string().uuid().nullable(),
  kind: revenueAllocationKindSchema,
  amountMinor: moneyMinorStringSchema,
  currency: financeCurrencySchema,
  academyPercentage: academyPercentageSchema,
  academyAmountMinor: moneyMinorStringSchema,
  teacherAmountMinor: moneyMinorStringSchema,
  refundId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export type RevenueAllocation = z.infer<typeof revenueAllocationSchema>;

export const revenueAllocationListResponseSchema = z.object({
  allocations: z.array(revenueAllocationSchema),
});

export type RevenueAllocationListResponse = z.infer<
  typeof revenueAllocationListResponseSchema
>;

export const revenueAllocationResponseSchema = z.object({
  allocation: revenueAllocationSchema,
});

export type RevenueAllocationResponse = z.infer<
  typeof revenueAllocationResponseSchema
>;

export const allocationListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  chargeId: z.string().uuid().optional(),
  kind: revenueAllocationKindSchema.optional(),
  currency: financeCurrencySchema.optional(),
});

export type AllocationListQuery = z.infer<typeof allocationListQuerySchema>;

export const teacherSettlementSchema = z.object({
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalTeacherAmountMinor: moneyMinorStringSchema,
  currency: financeCurrencySchema,
  status: teacherSettlementStatusSchema,
  markedPaidAt: z.string().datetime().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TeacherSettlement = z.infer<typeof teacherSettlementSchema>;

export const teacherSettlementListResponseSchema = z.object({
  settlements: z.array(teacherSettlementSchema),
});

export type TeacherSettlementListResponse = z.infer<
  typeof teacherSettlementListResponseSchema
>;

export const teacherSettlementResponseSchema = z.object({
  settlement: teacherSettlementSchema,
});

export type TeacherSettlementResponse = z.infer<
  typeof teacherSettlementResponseSchema
>;

export const createTeacherSettlementRequestSchema = z.object({
  teacherId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  currency: financeCurrencySchema,
  note: z.string().trim().max(1000).optional(),
});

export type CreateTeacherSettlementRequest = z.infer<
  typeof createTeacherSettlementRequestSchema
>;

export const markTeacherSettlementPaidRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export type MarkTeacherSettlementPaidRequest = z.infer<
  typeof markTeacherSettlementPaidRequestSchema
>;

export const settlementListQuerySchema = z.object({
  teacherId: z.string().uuid().optional(),
  status: teacherSettlementStatusSchema.optional(),
  currency: financeCurrencySchema.optional(),
});

export type SettlementListQuery = z.infer<typeof settlementListQuerySchema>;

/**
 * Stub webhook inbox payload (no live SDK). Signature verification is TODO
 * when provider credentials are introduced.
 */
export const financeWebhookRequestSchema = z.object({
  providerEventId: z.string().trim().min(1).max(191),
  type: z.string().trim().min(1).max(120),
  paymentId: z.string().uuid().optional(),
  payload: z.unknown().optional(),
});

export type FinanceWebhookRequest = z.infer<typeof financeWebhookRequestSchema>;

export const financeWebhookResponseSchema = z.object({
  received: z.literal(true),
  duplicate: z.boolean(),
  processed: z.boolean(),
});

export type FinanceWebhookResponse = z.infer<
  typeof financeWebhookResponseSchema
>;
