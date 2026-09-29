'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { MembershipBenefits } from '@/components/membership/membership-benefits'
import { MembershipHeader } from '@/components/membership/membership-header'
import { MembershipPauseInfo } from '@/components/membership/membership-pause-info'
import { MembershipPlans } from '@/components/membership/membership-plans'
import type { MembershipPlanId } from '@/lib/membership-plans'

/**
 * Membership plans UI (Nivel Plata). Selection is local-only for now;
 * `onSelectPlan` is ready to wire to a future subscription API.
 */
export default function MembershipPage() {
  const [selectedPlanId, setSelectedPlanId] = useState<MembershipPlanId | null>(
    null,
  )

  function handleSelectPlan(planId: MembershipPlanId) {
    setSelectedPlanId(planId)
  }

  return (
    <DashboardShell title="Membresía">
      <MembershipHeader />
      <MembershipPlans
        selectedPlanId={selectedPlanId}
        onSelectPlan={handleSelectPlan}
      />
      <MembershipBenefits />
      <MembershipPauseInfo />
    </DashboardShell>
  )
}
