'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type {
  AdminPaymentSubmission,
  PaymentSubmissionStatus,
} from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Button, Skeleton } from '@/components/ui/primitives'
import {
  approveFinanceSubmissionBrowser,
  getFinanceSubmissionReceiptBrowser,
  listFinanceSubmissionsBrowser,
  reviewFinanceSubmissionBrowser,
} from '@/lib/api-browser'
import { formatMoneyMinor } from '@/lib/finance-display'
import { canMutateFinanceUi } from '@/lib/stage1-identity'

const STATUS_FILTERS: Array<PaymentSubmissionStatus | 'ALL'> = [
  'ALL',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_CORRECTION',
  'REJECTED',
  'APPROVED',
]

export default function FinanceSubmissionsPage() {
  const user = useSessionUser()
  const canMutate = canMutateFinanceUi(user.role)
  const [rows, setRows] = useState<AdminPaymentSubmission[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<PaymentSubmissionStatus | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await listFinanceSubmissionsBrowser({
      ...(status === 'ALL' ? {} : { status }),
      limit: 50,
      offset: 0,
    })
    if (!result.ok) {
      setError(result.message)
      setLoading(false)
      return
    }
    setRows(result.data.submissions)
    setTotal(result.data.total)
    setLoading(false)
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  async function runReview(
    id: string,
    action: 'take_under_review' | 'request_correction' | 'reject',
  ) {
    setBusyId(id)
    setError('')
    const result = await reviewFinanceSubmissionBrowser(id, {
      action,
      ...(note.trim() ? { adminNote: note.trim() } : {}),
    })
    setBusyId('')
    if (!result.ok) {
      setError(result.message)
      return
    }
    setNote('')
    await load()
  }

  async function openReceipt(id: string) {
    setBusyId(id)
    setError('')
    const result = await getFinanceSubmissionReceiptBrowser(id)
    setBusyId('')
    if (!result.ok) {
      setError(result.message)
      return
    }
    window.open(result.data.downloadUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <DashboardShell title="Comprobantes">
      <PageHeader
        eyebrow="Finanzas"
        title="Bandeja de comprobantes"
        description="Revisá transferencias informadas por estudiantes. Aprobar exige monto exacto, comprobante y confirmación explícita de recepción del dinero."
      />
      <p className="mt-2 text-sm">
        <Link href="/dashboard/finance" className="underline">
          Volver a finanzas
        </Link>
      </p>

      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Estado
          <select
            className="mt-1 block rounded-md border border-border bg-surface px-3 py-2"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as PaymentSubmissionStatus | 'ALL')
            }
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[16rem] flex-1 text-sm">
          Nota administrativa
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Obligatoria para corrección o rechazo"
          />
        </label>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Actualizar
        </Button>
      </div>

      {loading ? (
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {rows.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              No hay comprobantes{status === 'ALL' ? '' : ` en ${status}`}.
              Total: {total}.
            </li>
          ) : (
            rows.map((row) => (
              <li key={row.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{row.status}</p>
                  <p className="text-sm">
                    Informado{' '}
                    {formatMoneyMinor(
                      row.reportedAmountMinor,
                      row.reportedCurrency,
                    )}{' '}
                    · Adeudado{' '}
                    {formatMoneyMinor(
                      row.chargeAmountMinor,
                      row.chargeCurrency,
                    )}
                    {row.amountMatchesCharge ? '' : ' · Diferencia'}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Estudiante {row.studentId.slice(0, 8)} · Cargo{' '}
                  {row.chargeId.slice(0, 8)} · Pagado el{' '}
                  {new Date(row.paidAt).toLocaleString('es-AR')}
                  {row.studentNote ? ` · ${row.studentNote}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {row.hasReceipt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === row.id}
                      onClick={() => void openReceipt(row.id)}
                    >
                      Ver comprobante
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sin archivo
                    </span>
                  )}
                  {canMutate && row.status !== 'APPROVED' && row.status !== 'REJECTED' ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() =>
                          void runReview(row.id, 'take_under_review')
                        }
                      >
                        Tomar en revisión
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busyId === row.id}
                        onClick={() =>
                          void runReview(row.id, 'request_correction')
                        }
                      >
                        Pedir corrección
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busyId === row.id}
                        onClick={() => void runReview(row.id, 'reject')}
                      >
                        Rechazar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          busyId === row.id ||
                          !row.amountMatchesCharge ||
                          !row.hasReceipt
                        }
                        onClick={() => {
                          void (async () => {
                            setBusyId(row.id)
                            setError('')
                            const result =
                              await approveFinanceSubmissionBrowser(row.id, {
                                moneyReceivedConfirmed: true,
                                ...(note.trim()
                                  ? { adminNote: note.trim() }
                                  : {}),
                              })
                            setBusyId('')
                            if (!result.ok) {
                              setError(result.message)
                              return
                            }
                            setNote('')
                            await load()
                          })()
                        }}
                      >
                        Aprobar (recibí el dinero)
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </DashboardShell>
  )
}
