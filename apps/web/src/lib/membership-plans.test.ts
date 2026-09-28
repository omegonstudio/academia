import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_BENEFITS,
  MEMBERSHIP_PLAN_IDS,
  MEMBERSHIP_PLANS,
  formatMembershipPrice,
  hasLegacyPrice,
  membershipPrimaryPrice,
} from './membership-plans.js';

describe('membershipPlans data', () => {
  it('defines the three Nivel Plata plan ids', () => {
    expect(MEMBERSHIP_PLAN_IDS).toEqual(['monthly', 'quarterly', 'annual']);
    expect(MEMBERSHIP_PLANS.map((plan) => plan.id)).toEqual([
      'monthly',
      'quarterly',
      'annual',
    ]);
  });

  it('keeps the reference prices from the commercial analysis', () => {
    const byId = Object.fromEntries(
      MEMBERSHIP_PLANS.map((plan) => [plan.id, plan]),
    );
    expect(byId['monthly']?.price).toBe(31);
    expect(byId['quarterly']?.price).toBe(51.15);
    expect(byId['quarterly']?.monthlyEquivalent).toBe(17.05);
    expect(byId['quarterly']?.savingsPercent).toBe(45);
    expect(byId['annual']?.price).toBe(186);
    expect(byId['annual']?.monthlyEquivalent).toBe(15.5);
    expect(byId['annual']?.savingsPercent).toBe(50);
    expect(byId['annual']?.highlighted).toBe(true);
  });

  it('formats EUR amounts for es-ES display', () => {
    expect(formatMembershipPrice(31)).toMatch(/31/);
    expect(formatMembershipPrice(17.05)).toMatch(/17[,.]05/);
  });

  it('uses monthly equivalent as the primary display when present', () => {
    const annual = MEMBERSHIP_PLANS.find((plan) => plan.id === 'annual');
    expect(annual).toBeDefined();
    expect(membershipPrimaryPrice(annual!).amount).toBe(15.5);
  });

  it('does not treat plans as legacy unless both fields are set', () => {
    for (const plan of MEMBERSHIP_PLANS) {
      expect(hasLegacyPrice(plan)).toBe(false);
    }
    expect(
      hasLegacyPrice({
        ...MEMBERSHIP_PLANS[0]!,
        isLegacyPrice: true,
        legacyPrice: 20,
      }),
    ).toBe(true);
  });

  it('lists common benefits once (not per plan)', () => {
    expect(MEMBERSHIP_BENEFITS.length).toBeGreaterThanOrEqual(15);
    expect(MEMBERSHIP_BENEFITS).toContain('Conjugador');
    expect(MEMBERSHIP_BENEFITS).toContain('Acceso multidispositivo');
  });
});
