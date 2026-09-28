import { describe, expect, it } from 'vitest'
import {
  allocationKindLabel,
  chargeStatusLabel,
  formatChargeRow,
  formatMoneyMinor,
  paymentProviderLabel,
  paymentStatusLabel,
  settlementStatusLabel,
} from './finance-display'

describe('finance-display', () => {
  it('formats minor units with currency', () => {
    expect(formatMoneyMinor('10000', 'ARS')).toBe('ARS 100,00')
    expect(formatMoneyMinor('-4000', 'USD')).toBe('-USD 40,00')
  })

  it('labels domain enums in Spanish', () => {
    expect(chargeStatusLabel('OPEN')).toBe('Abierto')
    expect(paymentStatusLabel('SUCCEEDED')).toBe('Confirmado')
    expect(paymentProviderLabel('MANUAL')).toBe('Manual')
    expect(settlementStatusLabel('OPEN')).toBe('Pendiente de pago')
    expect(allocationKindLabel('REVERSAL')).toBe('Reverso')
  })

  it('maps an API Charge DTO into Finance table fields', () => {
    const classSessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const row = formatChargeRow({
      amountMinor: '15000',
      currency: 'ARS',
      status: 'OPEN',
      classSessionId,
      enrollmentId: null,
    })
    expect(row.amount).toBe('ARS 150,00')
    expect(row.status).toBe('Abierto')
    expect(row.context).toBe('Clase aaaaaaaa')

    const monthly = formatChargeRow({
      amountMinor: '50000',
      currency: 'USD',
      status: 'PAID',
      classSessionId: null,
      enrollmentId: '11111111-2222-3333-4444-555555555555',
    })
    expect(monthly.amount).toBe('USD 500,00')
    expect(monthly.status).toBe('Pagado')
    expect(monthly.context).toBe('Matrícula 11111111')
  })
})
