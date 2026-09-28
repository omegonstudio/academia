import { describe, expect, it } from 'vitest'
import type {
  StudentFinanceCharge,
  StudentFinancePayment,
} from '@academia/shared'
import {
  chargeCheckoutUiState,
  chargeContextLabel,
  formatFinanceDate,
  hasFinanceActivity,
} from './student-finance'

function charge(
  overrides: Partial<StudentFinanceCharge> = {},
): StudentFinanceCharge {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    amountMinor: '12500',
    currency: 'ARS',
    status: 'OPEN',
    description: null,
    courseId: null,
    groupId: null,
    enrollmentId: null,
    classSessionId: null,
    periodStart: null,
    periodEnd: null,
    createdAt: '2026-09-20T15:00:00.000Z',
    updatedAt: '2026-09-20T15:00:00.000Z',
    ...overrides,
  }
}

function payment(
  overrides: Partial<StudentFinancePayment> = {},
): StudentFinancePayment {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    chargeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    amountMinor: '12500',
    currency: 'ARS',
    status: 'PENDING',
    provider: 'MERCADOPAGO',
    providerPaymentId: 'mp_stub_1',
    createdAt: '2026-09-20T15:00:00.000Z',
    updatedAt: '2026-09-20T15:00:00.000Z',
    ...overrides,
  }
}

describe('student-finance helpers', () => {
  it('labels charge context from description, class or period', () => {
    expect(
      chargeContextLabel(charge({ description: 'Español 1:1' })),
    ).toBe('Español 1:1')
    expect(
      chargeContextLabel(
        charge({ classSessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
      ),
    ).toMatch(/clase/i)
    expect(
      chargeContextLabel(
        charge({ enrollmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
      ),
    ).toMatch(/per[ií]odo/i)
    expect(chargeContextLabel(charge())).toBe('Cargo')
  })

  it('formats dates in academy timezone and detects empty activity', () => {
    expect(formatFinanceDate('2026-09-20T15:00:00.000Z')).toMatch(/2026/)
    expect(hasFinanceActivity({ charges: [], payments: [] })).toBe(false)
    expect(
      hasFinanceActivity({ charges: [charge()], payments: [] }),
    ).toBe(true)
  })

  it('derives checkout UI state for Pay vs pending', () => {
    expect(chargeCheckoutUiState(charge(), [])).toBe('payable')
    expect(chargeCheckoutUiState(charge(), [payment()])).toBe('pending')
    expect(
      chargeCheckoutUiState(charge({ status: 'PAID' }), [
        payment({ status: 'SUCCEEDED' }),
      ]),
    ).toBe('other')
    expect(
      chargeCheckoutUiState(charge({ status: 'CANCELLED' }), []),
    ).toBe('other')
  })
})
