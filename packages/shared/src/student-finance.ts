import { z } from 'zod';
import {
  chargeStatusSchema,
  financeCurrencySchema,
  moneyMinorStringSchema,
  nonNegativeMoneyMinorStringSchema,
  paymentProviderSchema,
  paymentStatusSchema,
} from './finance.js';

/**
 * Student Finance Portal — read-only, session-scoped DTOs.
 * Never include academy/teacher split, settlements, or admin-only fields.
 */

export const studentFinanceChargeSchema = z.object({
  id: z.string().uuid(),
  amountMinor: nonNegativeMoneyMinorStringSchema,
  currency: financeCurrencySchema,
  status: chargeStatusSchema,
  description: z.string().nullable(),
  courseId: z.string().uuid().nullable(),
  groupId: z.string().uuid().nullable(),
  enrollmentId: z.string().uuid().nullable(),
  classSessionId: z.string().uuid().nullable(),
  periodStart: z.string().datetime().nullable(),
  periodEnd: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StudentFinanceCharge = z.infer<typeof studentFinanceChargeSchema>;

export const studentFinancePaymentSchema = z.object({
  id: z.string().uuid(),
  chargeId: z.string().uuid(),
  amountMinor: nonNegativeMoneyMinorStringSchema,
  currency: financeCurrencySchema,
  status: paymentStatusSchema,
  provider: paymentProviderSchema,
  /** External provider reference when present; never webhook payloads. */
  providerPaymentId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StudentFinancePayment = z.infer<typeof studentFinancePaymentSchema>;

export const studentFinanceRefundSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  amountMinor: nonNegativeMoneyMinorStringSchema,
  currency: financeCurrencySchema,
  createdAt: z.string().datetime(),
});

export type StudentFinanceRefund = z.infer<typeof studentFinanceRefundSchema>;

export const studentFinanceSummarySchema = z.object({
  openCharges: z.number().int().nonnegative(),
  paidCharges: z.number().int().nonnegative(),
  cancelledCharges: z.number().int().nonnegative(),
  succeededPayments: z.number().int().nonnegative(),
  /** Sum of OPEN charge amounts by currency (string minor units). */
  openAmountByCurrency: z.array(
    z.object({
      currency: financeCurrencySchema,
      amountMinor: moneyMinorStringSchema,
    }),
  ),
});

export type StudentFinanceSummary = z.infer<typeof studentFinanceSummarySchema>;

export const studentFinanceResponseSchema = z.object({
  summary: studentFinanceSummarySchema,
  charges: z.array(studentFinanceChargeSchema),
  payments: z.array(studentFinancePaymentSchema),
  refunds: z.array(studentFinanceRefundSchema),
});

export type StudentFinanceResponse = z.infer<typeof studentFinanceResponseSchema>;

/** Response for POST /students/me/finance/charges/:chargeId/pay */
export const studentFinanceCheckoutResponseSchema = z.object({
  payment: studentFinancePaymentSchema,
});

export type StudentFinanceCheckoutResponse = z.infer<
  typeof studentFinanceCheckoutResponseSchema
>;
