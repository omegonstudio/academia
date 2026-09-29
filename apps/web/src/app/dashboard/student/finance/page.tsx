'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentFinanceResponse } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Button, Skeleton } from '@/components/ui/primitives'
import {
  getStudentMeFinanceBrowser,
  payStudentMeFinanceChargeBrowser,
} from '@/lib/api-browser'
import {
  chargeStatusLabel,
  formatMoneyMinor,
  paymentProviderLabel,
  paymentStatusLabel,
} from '@/lib/finance-display'
import {
  chargeCheckoutUiState,
  chargeContextLabel,
  formatFinanceDate,
} from '@/lib/student-finance'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: StudentFinanceResponse }

export default function StudentFinancePage() {
  const user = useSessionUser()
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [payingId, setPayingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function reloadFinance() {
    const result = await getStudentMeFinanceBrowser()
    if (!result.ok) {
      setState({ status: 'error', message: result.message })
      return
    }
    setState({ status: 'ready', data: result.data })
  }

  useEffect(() => {
    if (user.role !== 'STUDENT') {
      router.replace('/dashboard')
      return
    }
    let cancelled = false
    void (async () => {
      const result = await getStudentMeFinanceBrowser()
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error', message: result.message })
        return
      }
      setState({ status: 'ready', data: result.data })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  async function handlePay(chargeId: string) {
    setActionError(null)
    setPayingId(chargeId)
    const result = await payStudentMeFinanceChargeBrowser(chargeId)
    setPayingId(null)
    if (!result.ok) {
      setActionError(result.message)
      return
    }
    await reloadFinance()
  }

  const empty =
    state.status === 'ready' &&
    state.data.charges.length === 0 &&
    state.data.payments.length === 0

  return (
    <DashboardShell title="Finanzas">
      <PageHeader
        eyebrow="Estudiante"
        title="Mis finanzas"
        description="Consulta tus cargos y pagá los que estén abiertos."
      />

      {state.status === 'loading' ? (
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
      ) : null}

      {state.status === 'error' ? (
        <div className="mt-6">
          <Alert tone="danger">{state.message}</Alert>
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-6">
          <Alert tone="danger">{actionError}</Alert>
        </div>
      ) : null}

      {state.status === 'ready' && empty ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No tenés movimientos financieros todavía.
        </p>
      ) : null}

      {state.status === 'ready' && !empty ? (
        <div className="mt-6 space-y-8">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Cargos pendientes</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {state.data.summary.openCharges}
              </p>
              {state.data.summary.openAmountByCurrency.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {state.data.summary.openAmountByCurrency.map((row) => (
                    <li key={row.currency}>
                      {formatMoneyMinor(row.amountMinor, row.currency)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Cargos pagados</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {state.data.summary.paidCharges}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Pagos confirmados</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {state.data.summary.succeededPayments}
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Cargos</h2>
            {state.data.charges.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No hay cargos en tu cuenta.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
                {state.data.charges.map((charge) => {
                  const checkout = chargeCheckoutUiState(
                    charge,
                    state.data.payments,
                  )
                  return (
                    <li key={charge.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">
                          {chargeContextLabel(charge)}
                        </p>
                        <p className="text-sm font-semibold">
                          {formatMoneyMinor(
                            charge.amountMinor,
                            charge.currency,
                          )}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                          {chargeStatusLabel(charge.status)} ·{' '}
                          {formatFinanceDate(charge.createdAt)}
                        </p>
                        {checkout === 'payable' ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={payingId === charge.id}
                            onClick={() => void handlePay(charge.id)}
                          >
                            {payingId === charge.id ? 'Iniciando…' : 'Pagar'}
                          </Button>
                        ) : null}
                        {checkout === 'pending' ? (
                          <p className="text-sm font-medium text-muted-foreground">
                            Pago pendiente
                          </p>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Pagos</h2>
            {state.data.payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No hay pagos registrados.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
                {state.data.payments.map((payment) => (
                  <li key={payment.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        {paymentProviderLabel(payment.provider)}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatMoneyMinor(
                          payment.amountMinor,
                          payment.currency,
                        )}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {paymentStatusLabel(payment.status)} ·{' '}
                      {formatFinanceDate(payment.createdAt)}
                      {payment.providerPaymentId
                        ? ` · Ref. ${payment.providerPaymentId}`
                        : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {state.data.refunds.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold tracking-tight">
                Reembolsos
              </h2>
              <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
                {state.data.refunds.map((refund) => (
                  <li key={refund.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">Reembolso</p>
                      <p className="text-sm font-semibold">
                        {formatMoneyMinor(refund.amountMinor, refund.currency)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatFinanceDate(refund.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </DashboardShell>
  )
}
