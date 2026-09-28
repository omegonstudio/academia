import type {
  StudentFinanceCharge,
  StudentFinancePayment,
} from '@academia/shared'

/** Human label for a charge row without inventing commercial concepts. */
export function chargeContextLabel(charge: StudentFinanceCharge): string {
  if (charge.description?.trim()) {
    return charge.description.trim()
  }
  if (charge.classSessionId) {
    return 'Cargo por clase'
  }
  if (charge.enrollmentId || charge.periodStart) {
    return 'Cargo por período'
  }
  return 'Cargo'
}

export function formatFinanceDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

export function hasFinanceActivity(data: {
  charges: readonly unknown[]
  payments: readonly unknown[]
}): boolean {
  return data.charges.length > 0 || data.payments.length > 0
}

export type ChargeCheckoutUiState = 'payable' | 'pending' | 'other'

/**
 * UX for the Pay button. Backend remains the authority.
 * OPEN + no payment → payable; OPEN + PENDING payment → pending (no second pay).
 */
export function chargeCheckoutUiState(
  charge: StudentFinanceCharge,
  payments: readonly StudentFinancePayment[],
): ChargeCheckoutUiState {
  if (charge.status !== 'OPEN') return 'other'
  const payment = payments.find((row) => row.chargeId === charge.id)
  if (!payment) return 'payable'
  if (payment.status === 'PENDING') return 'pending'
  return 'other'
}
