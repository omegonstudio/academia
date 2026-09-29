'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  ACADEMY_PERCENTAGES,
  type AcademyPercentage,
  type Charge,
  type FinanceSettings,
  type Payment,
  type RevenueAllocation,
  type TeacherSettlement,
} from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Button, Skeleton } from '@/components/ui/primitives'
import {
  createPaymentBrowser,
  getFinanceSettingsBrowser,
  listAllocationsBrowser,
  listChargesBrowser,
  listPaymentsBrowser,
  listSettlementsBrowser,
  markSettlementPaidBrowser,
  refundPaymentBrowser,
  succeedManualPaymentBrowser,
  updateFinanceSettingsBrowser,
} from '@/lib/api-browser'
import {
  allocationKindLabel,
  formatChargeRow,
  formatMoneyMinor,
  paymentProviderLabel,
  paymentStatusLabel,
  settlementStatusLabel,
  shortId,
} from '@/lib/finance-display'
import {
  canEditFinanceSettingsUi,
  canMutateFinanceUi,
} from '@/lib/stage1-identity'

export default function FinancePage() {
  const user = useSessionUser()
  const canEditSettings = canEditFinanceSettingsUi(user.role)
  const canMutate = canMutateFinanceUi(user.role)

  const [settings, setSettings] = useState<FinanceSettings | null>(null)
  const [draftPct, setDraftPct] = useState<AcademyPercentage>(40)
  const [charges, setCharges] = useState<Charge[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [allocations, setAllocations] = useState<RevenueAllocation[]>([])
  const [settlements, setSettlements] = useState<TeacherSettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [s, c, p, a, t] = await Promise.all([
      getFinanceSettingsBrowser(),
      listChargesBrowser(),
      listPaymentsBrowser(),
      listAllocationsBrowser(),
      listSettlementsBrowser(),
    ])
    if (!s.ok) {
      setError(s.message)
      setLoading(false)
      return
    }
    if (!c.ok || !p.ok || !a.ok || !t.ok) {
      setError(
        (!c.ok && c.message) ||
          (!p.ok && p.message) ||
          (!a.ok && a.message) ||
          (!t.ok && t.message) ||
          'No pudimos cargar finanzas.',
      )
      setLoading(false)
      return
    }
    setSettings(s.data)
    setDraftPct(s.data.academyPercentage)
    setCharges(c.data)
    setPayments(p.data)
    setAllocations(a.data)
    setSettlements(t.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveSettings() {
    if (!canEditSettings) return
    setSavingSettings(true)
    setError('')
    setSuccess('')
    const result = await updateFinanceSettingsBrowser(draftPct)
    setSavingSettings(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSettings(result.data)
    setSuccess(
      `Configuración guardada: academia ${result.data.academyPercentage}% / profesor ${result.data.teacherPercentage}%.`,
    )
  }

  async function createManualPayment(chargeId: string) {
    setBusyId(chargeId)
    setError('')
    setSuccess('')
    const result = await createPaymentBrowser({
      chargeId,
      provider: 'MANUAL',
      idempotencyKey: `ui-manual-${chargeId}-${Date.now()}`,
    })
    setBusyId('')
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSuccess('Pago manual creado (pendiente).')
    await load()
  }

  async function succeedPayment(paymentId: string) {
    setBusyId(paymentId)
    setError('')
    setSuccess('')
    const result = await succeedManualPaymentBrowser(paymentId)
    setBusyId('')
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSuccess('Pago confirmado. Allocation congelada.')
    await load()
  }

  async function refundPayment(paymentId: string) {
    setBusyId(paymentId)
    setError('')
    setSuccess('')
    const result = await refundPaymentBrowser(paymentId, 'Reembolso total desde panel')
    setBusyId('')
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSuccess('Reembolso total registrado.')
    await load()
  }

  async function markPaid(settlementId: string) {
    setBusyId(settlementId)
    setError('')
    setSuccess('')
    const result = await markSettlementPaidBrowser(settlementId)
    setBusyId('')
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSuccess('Liquidación marcada como pagada.')
    await load()
  }

  return (
    <DashboardShell title="Finanzas">
      <PageHeader
        title="Finanzas"
        description="Configuración de split, cargos, pagos, allocations congeladas y liquidaciones docentes."
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Split academia / profesor</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Solo SUPER_ADMIN y DIRECTOR pueden cambiar el porcentaje. Los
              allocations ya congelados no se recalculan.
            </p>
            {settings ? (
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Academia %</span>
                  <select
                    className="min-h-10 rounded-xl border border-border bg-background px-3"
                    value={draftPct}
                    disabled={!canEditSettings || savingSettings}
                    onChange={(event) =>
                      setDraftPct(Number(event.target.value) as AcademyPercentage)
                    }
                  >
                    {ACADEMY_PERCENTAGES.map((value) => (
                      <option key={value} value={value}>
                        {value}%
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm">
                  Profesor:{' '}
                  <strong>{100 - draftPct}%</strong>
                </p>
                {canEditSettings ? (
                  <Button
                    type="button"
                    disabled={
                      savingSettings ||
                      draftPct === settings.academyPercentage
                    }
                    onClick={() => void saveSettings()}
                  >
                    {savingSettings ? 'Guardando…' : 'Guardar'}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Solo lectura para tu rol.
                  </p>
                )}
              </div>
            ) : null}
          </section>

          <FinanceTable
            title="Cargos"
            empty="No hay cargos todavía."
            headers={[
              'Estudiante',
              'Monto',
              'Estado',
              'Contexto',
              'Creado',
              'Acciones',
            ]}
            rowCount={charges.length}
          >
            {charges.map((charge) => {
              const display = formatChargeRow(charge)
              return (
              <tr key={charge.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link
                    href={`/dashboard/finance/students/${charge.studentId}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {shortId(charge.studentId)}
                  </Link>
                </td>
                <td className="px-3 py-2">{display.amount}</td>
                <td className="px-3 py-2">{display.status}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {display.context}
                </td>
                <td className="px-3 py-2 text-xs">
                  {new Date(charge.createdAt).toLocaleString('es-AR')}
                </td>
                <td className="px-3 py-2">
                  {canMutate && charge.status === 'OPEN' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === charge.id}
                      onClick={() => void createManualPayment(charge.id)}
                    >
                      Pago manual
                    </Button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
              )
            })}
          </FinanceTable>

          <FinanceTable
            title="Pagos"
            empty="No hay pagos todavía."
            headers={[
              'Cargo',
              'Monto',
              'Proveedor',
              'Estado',
              'Ref.',
              'Acciones',
            ]}
            rowCount={payments.length}
          >
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">
                  {shortId(payment.chargeId)}
                </td>
                <td className="px-3 py-2">
                  {formatMoneyMinor(payment.amountMinor, payment.currency)}
                </td>
                <td className="px-3 py-2">
                  {paymentProviderLabel(payment.provider)}
                </td>
                <td className="px-3 py-2">
                  {paymentStatusLabel(payment.status)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {payment.providerPaymentId
                    ? shortId(payment.providerPaymentId)
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {canMutate &&
                    payment.provider === 'MANUAL' &&
                    payment.status === 'PENDING' ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === payment.id}
                        onClick={() => void succeedPayment(payment.id)}
                      >
                        Confirmar
                      </Button>
                    ) : null}
                    {canMutate && payment.status === 'SUCCEEDED' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={busyId === payment.id}
                        onClick={() => void refundPayment(payment.id)}
                      >
                        Reembolso total
                      </Button>
                    ) : null}
                    {!canMutate ||
                    (payment.status !== 'PENDING' &&
                      payment.status !== 'SUCCEEDED')
                      ? '—'
                      : null}
                  </div>
                </td>
              </tr>
            ))}
          </FinanceTable>

          <FinanceTable
            title="Asignaciones de ingresos (congeladas)"
            empty="No hay allocations todavía."
            headers={[
              'Tipo',
              'Profesor',
              'Academia %',
              'Academia',
              'Profesor $',
              'Fecha',
            ]}
            rowCount={allocations.length}
          >
            {allocations.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2">{allocationKindLabel(row.kind)}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/dashboard/finance/teachers/${row.teacherId}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {shortId(row.teacherId)}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.academyPercentage}%</td>
                <td className="px-3 py-2">
                  {formatMoneyMinor(row.academyAmountMinor, row.currency)}
                </td>
                <td className="px-3 py-2">
                  {formatMoneyMinor(row.teacherAmountMinor, row.currency)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {new Date(row.createdAt).toLocaleString('es-AR')}
                </td>
              </tr>
            ))}
          </FinanceTable>

          <FinanceTable
            title="Liquidaciones docentes"
            empty="No hay liquidaciones todavía."
            headers={['Profesor', 'Período', 'Monto', 'Estado', 'Acciones']}
            rowCount={settlements.length}
          >
            {settlements.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link
                    href={`/dashboard/finance/teachers/${row.teacherId}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {shortId(row.teacherId)}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {new Date(row.periodStart).toLocaleDateString('es-AR')} →{' '}
                  {new Date(row.periodEnd).toLocaleDateString('es-AR')}
                </td>
                <td className="px-3 py-2">
                  {formatMoneyMinor(row.totalTeacherAmountMinor, row.currency)}
                </td>
                <td className="px-3 py-2">
                  {settlementStatusLabel(row.status)}
                </td>
                <td className="px-3 py-2">
                  {canMutate && row.status === 'OPEN' ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void markPaid(row.id)}
                    >
                      Marcar pagado
                    </Button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </FinanceTable>
        </div>
      )}
    </DashboardShell>
  )
}

function FinanceTable({
  title,
  empty,
  headers,
  rowCount,
  children,
}: {
  title: string
  empty: string
  headers: string[]
  rowCount: number
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowCount > 0 ? (
              children
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-3 py-6 text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
