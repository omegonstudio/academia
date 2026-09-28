import { ACADEMY_PERCENTAGES, type AcademyPercentage } from '@academia/shared'

export function formatMoneyMinor(
  amountMinor: string,
  currency: 'ARS' | 'USD',
): string {
  const sign = amountMinor.startsWith('-') ? '-' : ''
  const digits = amountMinor.replace(/^-/, '')
  const padded = digits.padStart(3, '0')
  const whole = padded.slice(0, -2) || '0'
  const fraction = padded.slice(-2)
  return `${sign}${currency} ${whole},${fraction}`
}

export function academyPercentageOptions(): readonly AcademyPercentage[] {
  return ACADEMY_PERCENTAGES
}

export function chargeStatusLabel(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'Abierto'
    case 'PAID':
      return 'Pagado'
    case 'CANCELLED':
      return 'Cancelado'
    default:
      return status
  }
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Pendiente'
    case 'SUCCEEDED':
      return 'Confirmado'
    case 'FAILED':
      return 'Fallido'
    case 'CANCELLED':
      return 'Cancelado'
    case 'REFUNDED':
      return 'Reembolsado'
    default:
      return status
  }
}

export function paymentProviderLabel(provider: string): string {
  switch (provider) {
    case 'MERCADOPAGO':
      return 'Mercado Pago'
    case 'STRIPE':
      return 'Stripe'
    case 'MANUAL':
      return 'Manual'
    default:
      return provider
  }
}

export function settlementStatusLabel(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'Pendiente de pago'
    case 'MARKED_PAID':
      return 'Marcado como pagado'
    default:
      return status
  }
}

export function allocationKindLabel(kind: string): string {
  switch (kind) {
    case 'ORIGINAL':
      return 'Original'
    case 'REVERSAL':
      return 'Reverso'
    default:
      return kind
  }
}

export function shortId(id: string): string {
  return id.slice(0, 8)
}

/** Labels commercial context for a Charge DTO returned by the Finance API. */
export function chargeContextLabel(charge: {
  classSessionId: string | null
  enrollmentId: string | null
}): string {
  if (charge.classSessionId) {
    return `Clase ${shortId(charge.classSessionId)}`
  }
  if (charge.enrollmentId) {
    return `Matrícula ${shortId(charge.enrollmentId)}`
  }
  return '—'
}

/** Maps an API Charge into the Finance table display fields. */
export function formatChargeRow(charge: {
  amountMinor: string
  currency: 'ARS' | 'USD'
  status: string
  classSessionId: string | null
  enrollmentId: string | null
}): {
  amount: string
  status: string
  context: string
} {
  return {
    amount: formatMoneyMinor(charge.amountMinor, charge.currency),
    status: chargeStatusLabel(charge.status),
    context: chargeContextLabel(charge),
  }
}
