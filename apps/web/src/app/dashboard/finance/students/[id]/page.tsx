'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { Charge, Payment } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Alert, Skeleton } from '@/components/ui/primitives'
import {
  getStudentBrowser,
  listChargesBrowser,
  listPaymentsBrowser,
  personFullName,
} from '@/lib/api-browser'
import {
  chargeStatusLabel,
  formatMoneyMinor,
  paymentProviderLabel,
  paymentStatusLabel,
  shortId,
} from '@/lib/finance-display'

export default function StudentFinancePage() {
  const params = useParams<{ id: string }>()
  const studentId = params.id

  const [name, setName] = useState('')
  const [charges, setCharges] = useState<Charge[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError('')
    const [student, chargeList, paymentList] = await Promise.all([
      getStudentBrowser(studentId),
      listChargesBrowser({ studentId }),
      listPaymentsBrowser({ studentId }),
    ])
    if (!chargeList.ok) {
      setError(chargeList.message)
      setLoading(false)
      return
    }
    if (!paymentList.ok) {
      setError(paymentList.message)
      setLoading(false)
      return
    }
    if (student.ok) {
      setName(personFullName(student.data))
    } else {
      setName(shortId(studentId))
    }
    setCharges(chargeList.data)
    setPayments(paymentList.data)
    setLoading(false)
  }, [studentId])

  useEffect(() => {
    void load()
  }, [load])

  const openCharges = charges.filter((c) => c.status === 'OPEN')

  return (
    <DashboardShell title="Finanzas estudiante">
      <PageHeader
        title={`Finanzas · ${name || 'Estudiante'}`}
        description="Cargos y pagos del estudiante (ownership resuelto en API)."
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
          <p className="text-sm text-muted-foreground">
            Cargos abiertos: <strong>{openCharges.length}</strong>
          </p>
          <section>
            <h2 className="mb-2 font-semibold">Cargos</h2>
            <ul className="space-y-2 text-sm">
              {charges.length === 0 ? (
                <li className="text-muted-foreground">Sin cargos.</li>
              ) : (
                charges.map((charge) => (
                  <li
                    key={charge.id}
                    className="rounded-xl border border-border px-3 py-2"
                  >
                    {formatMoneyMinor(charge.amountMinor, charge.currency)} ·{' '}
                    {chargeStatusLabel(charge.status)} ·{' '}
                    {new Date(charge.createdAt).toLocaleDateString('es-AR')}
                  </li>
                ))
              )}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Pagos</h2>
            <ul className="space-y-2 text-sm">
              {payments.length === 0 ? (
                <li className="text-muted-foreground">Sin pagos.</li>
              ) : (
                payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="rounded-xl border border-border px-3 py-2"
                  >
                    {formatMoneyMinor(payment.amountMinor, payment.currency)} ·{' '}
                    {paymentProviderLabel(payment.provider)} ·{' '}
                    {paymentStatusLabel(payment.status)}
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
