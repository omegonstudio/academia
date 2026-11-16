import type { PaymentStatus } from '@academia/shared';
import { FinanceInvalidTransitionError } from './finance-errors.js';

const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ['SUCCEEDED', 'FAILED', 'CANCELLED'],
  SUCCEEDED: ['REFUNDED'],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Late PSP confirmation of a terminal attempt (DECISIONS #53).
 * Only used inside succeedPayment after Charge/OPEN + no other SUCCEEDED checks.
 */
const RECOVERY_TO_SUCCEEDED: readonly PaymentStatus[] = ['FAILED', 'CANCELLED'];

export function canTransitionPayment(
  from: PaymentStatus,
  to: PaymentStatus,
  options?: { allowTerminalRecovery?: boolean },
): boolean {
  if (ALLOWED_TRANSITIONS[from].includes(to)) return true;
  if (
    options?.allowTerminalRecovery &&
    to === 'SUCCEEDED' &&
    RECOVERY_TO_SUCCEEDED.includes(from)
  ) {
    return true;
  }
  return false;
}

export function assertPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
  options?: { allowTerminalRecovery?: boolean },
): void {
  if (!canTransitionPayment(from, to, options)) {
    throw new FinanceInvalidTransitionError(
      `Invalid payment transition: ${from} → ${to}.`,
    );
  }
}
