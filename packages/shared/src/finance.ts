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
