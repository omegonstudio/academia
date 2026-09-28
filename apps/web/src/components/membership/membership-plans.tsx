'use client'

import { MembershipPlanCard } from '@/components/membership/membership-plan-card'
import {
  MEMBERSHIP_PLANS,
  type MembershipPlanId,
} from '@/lib/membership-plans'

type MembershipPlansProps = {
  selectedPlanId: MembershipPlanId | null
  onSelectPlan: (planId: MembershipPlanId) => void
}

export function MembershipPlans({
  selectedPlanId,
  onSelectPlan,
}: MembershipPlansProps) {
  return (
    <section aria-labelledby="membership-plans-heading">
      <h2 id="membership-plans-heading" className="sr-only">
        Planes de membresía
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {MEMBERSHIP_PLANS.map((plan) => (
          <MembershipPlanCard
            key={plan.id}
            plan={plan}
            selected={selectedPlanId === plan.id}
            onSelect={onSelectPlan}
          />
        ))}
      </div>
    </section>
  )
}
