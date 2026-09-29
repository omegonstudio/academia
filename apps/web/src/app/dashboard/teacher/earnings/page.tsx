'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RevenueAllocation, TeacherSettlement } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Skeleton } from '@/components/ui/primitives'
import {
  listAllocationsBrowser,
  listSettlementsBrowser,
} from '@/lib/api-browser'
import {
  allocationKindLabel,
  formatMoneyMinor,
  settlementStatusLabel,
} from '@/lib/finance-display'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      allocations: RevenueAllocation[]
      settlements: TeacherSettlement[]
    }

export default function TeacherEarningsPage() {
  const user = useSessionUser()
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (user.role !== 'TEACHER') {
      router.replace('/dashboard')
      return
    }
    let cancelled = false
    void (async () => {
      const [allocResult, settlementResult] = await Promise.all([
        listAllocationsBrowser(),
        listSettlementsBrowser(),
      ])
      if (cancelled) return
      if (!allocResult.ok) {
        setState({ status: 'error', message: allocResult.message })
        return
      }
      if (!settlementResult.ok) {
        setState({ status: 'error', message: settlementResult.message })
        return
      }
      setState({
        status: 'ready',
        allocations: allocResult.data,
        settlements: settlementResult.data,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  return (
    <DashboardShell title="Earnings">
      <PageHeader
        eyebrow="Profesor"
        title="Earnings"
        description="Tus asignaciones de ingresos y liquidaciones. Solo lectura."
      />
      {state.status === 'loading' ? (
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      ) : null}
      {state.status === 'error' ? (
        <div className="mt-6">
          <Alert tone="danger">{state.message}</Alert>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className="mt-6 space-y-8">
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              Asignaciones de ingresos
            </h2>
            {state.allocations.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Todavía no hay asignaciones de ingresos registradas.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
                {state.allocations.map((row) => (
                  <li key={row.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        {allocationKindLabel(row.kind)}
                      </p>
                      <p className="text-sm font-medium">
                        {formatMoneyMinor(row.teacherAmountMinor, row.currency)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Academia {row.academyPercentage}% ·{' '}
                      {new Date(row.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              Liquidaciones
            </h2>
            {state.settlements.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Todavía no hay liquidaciones registradas.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
                {state.settlements.map((row) => (
                  <li key={row.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        {settlementStatusLabel(row.status)}
                      </p>
                      <p className="text-sm font-medium">
                        {formatMoneyMinor(
                          row.totalTeacherAmountMinor,
                          row.currency,
                        )}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(row.periodStart).toLocaleDateString('es-AR')} →{' '}
                      {new Date(row.periodEnd).toLocaleDateString('es-AR')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </DashboardShell>
  )
}
