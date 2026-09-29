'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { RevenueAllocation, TeacherSettlement } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Alert, Skeleton } from '@/components/ui/primitives'
import {
  getTeacherBrowser,
  listAllocationsBrowser,
  listSettlementsBrowser,
  personFullName,
} from '@/lib/api-browser'
import {
  allocationKindLabel,
  formatMoneyMinor,
  settlementStatusLabel,
  shortId,
} from '@/lib/finance-display'

export default function TeacherFinancePage() {
  const params = useParams<{ id: string }>()
  const teacherId = params.id

  const [name, setName] = useState('')
  const [allocations, setAllocations] = useState<RevenueAllocation[]>([])
  const [settlements, setSettlements] = useState<TeacherSettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!teacherId) return
    setLoading(true)
    setError('')
    const [teacher, allocList, settlementList] = await Promise.all([
      getTeacherBrowser(teacherId),
      listAllocationsBrowser({ teacherId }),
      listSettlementsBrowser({ teacherId }),
    ])
    if (!allocList.ok) {
      setError(allocList.message)
      setLoading(false)
      return
    }
    if (!settlementList.ok) {
      setError(settlementList.message)
      setLoading(false)
      return
    }
    if (teacher.ok) {
      setName(personFullName(teacher.data))
    } else {
      setName(shortId(teacherId))
    }
    setAllocations(allocList.data)
    setSettlements(settlementList.data)
    setLoading(false)
  }, [teacherId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <DashboardShell title="Finanzas profesor">
      <PageHeader
        title={`Finanzas · ${name || 'Profesor'}`}
        description="Earnings (allocations) y liquidaciones del profesor."
      />
      <p className="mb-4 text-sm">
        <Link href="/dashboard/finance" className="text-primary hover:underline">
          ← Volver a Finanzas
        </Link>
      </p>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-semibold">Asignaciones de ingresos</h2>
            <ul className="space-y-2 text-sm">
              {allocations.length === 0 ? (
                <li className="text-muted-foreground">Sin allocations.</li>
              ) : (
                allocations.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-border px-3 py-2"
                  >
                    {allocationKindLabel(row.kind)} · academia{' '}
                    {row.academyPercentage}% ·{' '}
                    {formatMoneyMinor(row.teacherAmountMinor, row.currency)} ·{' '}
                    {new Date(row.createdAt).toLocaleDateString('es-AR')}
                  </li>
                ))
              )}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Liquidaciones</h2>
            <ul className="space-y-2 text-sm">
              {settlements.length === 0 ? (
                <li className="text-muted-foreground">Sin liquidaciones.</li>
              ) : (
                settlements.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-border px-3 py-2"
                  >
                    {formatMoneyMinor(
                      row.totalTeacherAmountMinor,
                      row.currency,
                    )}{' '}
                    · {settlementStatusLabel(row.status)} ·{' '}
                    {new Date(row.periodStart).toLocaleDateString('es-AR')} →{' '}
                    {new Date(row.periodEnd).toLocaleDateString('es-AR')}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      )}
    </DashboardShell>
  )
}
