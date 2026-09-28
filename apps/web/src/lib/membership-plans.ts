/**
 * UI reference data for Academia — Nivel Plata membership plans.
 * Prices are configurable here (not inlined in JSX). No payment wiring yet.
 */

export const MEMBERSHIP_PLAN_IDS = ['monthly', 'quarterly', 'annual'] as const;

export type MembershipPlanId = (typeof MEMBERSHIP_PLAN_IDS)[number];

export type MembershipBillingPeriod = 'month' | 'quarter' | 'year';

export type MembershipPlan = {
  id: MembershipPlanId;
  name: string;
  /** Amount charged each billing cycle (EUR). */
  price: number;
  currency: 'EUR';
  billingPeriod: MembershipBillingPeriod;
  /** Shown as the primary price when billing is not monthly. */
  monthlyEquivalent?: number;
  /** Approximate savings vs paying monthly at list price (UI copy only). */
  savingsPercent?: number;
  highlighted?: boolean;
  highlights: readonly string[];
  /**
   * Reserved for future legacy pricing. When both are set, UI may show
   * protected pricing; omit until a real source provides them.
   */
  isLegacyPrice?: boolean;
  legacyPrice?: number;
};

/** Common benefits across all Nivel Plata plans — shown once below the cards. */
export const MEMBERSHIP_BENEFITS = [
  'Aproximadamente 10 cursos y herramientas',
  'El español paso a paso',
  'Conjugador',
  'Simulador de vida real',
  'Pronunciador',
  'Dictador',
  'Transcripciones y ejercicios de YouTube y pódcast',
  'Clases de conversación en vivo',
  'Resolución de dudas en vivo',
  'Archivo de grabaciones',
  'Sala Zoom 24 h para practicar entre alumnos',
  'Comunidad Telegram',
  'Quizzes diarios',
  'Gamificación con puntos, logros y ranking',
  'Acceso multidispositivo',
] as const;

export const MEMBERSHIP_PLANS: readonly MembershipPlan[] = [
  {
    id: 'monthly',
    name: 'Mensual',
    price: 31,
    currency: 'EUR',
    billingPeriod: 'month',
    highlights: [
      'Flexibilidad máxima',
      'Sin devolución del mes en curso',
      'Precio protegido mientras no canceles',
      'Permite pausa',
    ],
  },
  {
    id: 'quarterly',
    name: 'Trimestral',
    price: 51.15,
    currency: 'EUR',
    billingPeriod: 'quarter',
    monthlyEquivalent: 17.05,
    savingsPercent: 45,
    highlights: [
      'Facturación cada 3 meses',
      'Devolución durante 7 días',
      'Precio protegido mientras no canceles',
      'Permite pausa',
    ],
  },
  {
    id: 'annual',
    name: 'Anual',
    price: 186,
    currency: 'EUR',
    billingPeriod: 'year',
    monthlyEquivalent: 15.5,
    savingsPercent: 50,
    highlighted: true,
    highlights: [
      'Facturación anual',
      'Devolución durante 7 días',
      'Precio protegido mientras no canceles',
      'Permite pausa',
    ],
  },
] as const;

const EUR_FORMATTER = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMembershipPrice(amount: number): string {
  return EUR_FORMATTER.format(amount);
}

export function membershipBillingLabel(plan: MembershipPlan): string {
  switch (plan.billingPeriod) {
    case 'month':
      return 'Facturación mensual';
    case 'quarter':
      return `${formatMembershipPrice(plan.price)} cada 3 meses`;
    case 'year':
      return `${formatMembershipPrice(plan.price)} facturados anualmente`;
  }
}

export function membershipPrimaryPrice(plan: MembershipPlan): {
  amount: number;
  suffix: string;
} {
  if (plan.monthlyEquivalent !== undefined) {
    return { amount: plan.monthlyEquivalent, suffix: '/ mes' };
  }
  return { amount: plan.price, suffix: '/ mes' };
}

/** True when future legacy fields are both present and usable. */
export function hasLegacyPrice(plan: MembershipPlan): boolean {
  return plan.isLegacyPrice === true && typeof plan.legacyPrice === 'number';
}
