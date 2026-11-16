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

export type ChargeCheckoutUiState =
  | 'payable'
  | 'pending'
  | 'retryable'
  | 'other'

/**
 * UX for checkout CTAs. Backend remains the authority.
 * OPEN + no payment → payable (Pagar).
 * OPEN + PENDING → pending (Continuar pago; same Payment).
 * OPEN + FAILED → retryable (Reintentar pago; new Payment, history kept).
 * OPEN + CANCELLED → retryable (Volver a pagar).
 * Prefers the latest payment for the charge when several exist (#53).
 */
export function chargeCheckoutUiState(
  charge: StudentFinanceCharge,
  payments: readonly StudentFinancePayment[],
): ChargeCheckoutUiState {
  if (charge.status !== 'OPEN') return 'other'
  const forCharge = payments
    .filter((row) => row.chargeId === charge.id)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  const payment = forCharge[0]
  if (!payment) return 'payable'
  if (payment.status === 'PENDING') return 'pending'
  if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
    return 'retryable'
  }
  return 'other'
}

export function checkoutCtaLabel(state: ChargeCheckoutUiState): string | null {
  if (state === 'payable') return 'Pagar'
  if (state === 'pending') return 'Continuar pago'
  if (state === 'retryable') return 'Reintentar pago'
  return null
}

/** Shown when the API resumes/creates a Payment but returns no hosted URL. */
export const NO_CHECKOUT_URL_MESSAGE =
  'El pago quedó iniciado, pero no hay un enlace de checkout disponible ahora. Podés intentar Continuar pago de nuevo en unos minutos o contactar a la academia.'
