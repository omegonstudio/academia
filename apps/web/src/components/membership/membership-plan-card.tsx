'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatMembershipPrice,
  hasLegacyPrice,
  membershipBillingLabel,
  membershipPrimaryPrice,
  type MembershipPlan,
  type MembershipPlanId,
} from '@/lib/membership-plans'
import { Badge, Button } from '@/components/ui/primitives'

type MembershipPlanCardProps = {
  plan: MembershipPlan
  selected: boolean
  onSelect: (planId: MembershipPlanId) => void
}

export function MembershipPlanCard({
  plan,
  selected,
  onSelect,
}: MembershipPlanCardProps) {
  const primary = membershipPrimaryPrice(plan)
  const showLegacy = hasLegacyPrice(plan)

  return (
    <article
      className={cn(
        'relative flex h-full flex-col rounded-2xl border bg-surface p-6 transition',
        selected
          ? 'border-primary shadow-[0_16px_40px_-28px_rgba(170,21,27,.55)] ring-2 ring-primary/25'
          : plan.highlighted
            ? 'border-primary/35 shadow-sm'
            : 'border-border hover:border-primary/25',
      )}
      aria-labelledby={`plan-${plan.id}-title`}
    >
      {plan.highlighted ? (
        <Badge tone="info" className="absolute -top-2.5 left-6">
          Mayor ahorro
        </Badge>
      ) : null}
      {selected ? (
        <Badge tone="success" className="absolute -top-2.5 right-6">
          Plan seleccionado
        </Badge>
      ) : null}

      <header className="mt-1">
        <h3
          id={`plan-${plan.id}-title`}
          className="text-lg font-semibold tracking-tight"
        >
          {plan.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {membershipBillingLabel(plan)}
        </p>
      </header>

      <div className="mt-5">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight">
            {formatMembershipPrice(primary.amount)}
          </span>
          <span className="text-sm text-muted-foreground">{primary.suffix}</span>
        </p>
        {plan.monthlyEquivalent !== undefined ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMembershipPrice(plan.price)}{' '}
            {plan.billingPeriod === 'year' ? 'al año' : 'cada 3 meses'}
          </p>
        ) : null}
        {plan.savingsPercent !== undefined ? (
          <p className="mt-2 text-sm font-medium text-primary">
            Ahorrás ~{plan.savingsPercent} %
          </p>
        ) : null}
        {showLegacy ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Precio protegido:{' '}
            {formatMembershipPrice(plan.legacyPrice as number)}
          </p>
        ) : null}
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {plan.highlights.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-muted-foreground">
            <Check
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant={selected ? 'primary' : 'outline'}
        className="mt-7 w-full"
        aria-pressed={selected}
        onClick={() => onSelect(plan.id)}
      >
        {selected ? 'Plan seleccionado' : 'Elegir plan'}
      </Button>
    </article>
  )
}
