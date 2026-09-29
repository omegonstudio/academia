'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClassSessionCalendarEvent } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Skeleton } from '@/components/ui/primitives'
import { listClassSessionCalendarBrowser } from '@/lib/api-browser'
import { todayCivilDate } from '@/lib/calendar'
import {
  formatClassDateShort,
  formatClassScheduleLabel,
} from '@/lib/class-session-display'
import {
  countClassesOnCivilDay,
  pickNextClass,
  serviceTypeLabel,
  teacherHubClassRange,
} from '@/lib/teacher-hub'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      next: ClassSessionCalendarEvent | null
      todayCount: number
    }

export default function TeacherDashboardPage() {
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
      const range = teacherHubClassRange()
      const result = await listClassSessionCalendarBrowser(range.from, range.to)
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error', message: result.message })
        return
      }
      const events = result.data.classSessions
      const today = todayCivilDate()
      setState({
        status: 'ready',
        next: pickNextClass(events),
        todayCount: countClassesOnCivilDay(events, today),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  return (
    <DashboardShell title="Mi espacio">
      <PageHeader
        eyebrow="Profesor"
        title="Hola"
        description="Tu próxima clase, alumnos y materiales en un solo lugar."
      />

      <section className="mt-6 space-y-6">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <p className="text-sm font-semibold text-primary">Próxima clase</p>
          {state.status === 'loading' ? (
            <Skeleton className="mt-4 h-28 w-full rounded-xl" />
          ) : null}
          {state.status === 'error' ? (
            <div className="mt-4">
              <Alert tone="danger">{state.message}</Alert>
            </div>
          ) : null}
          {state.status === 'ready' && state.next ? (
            <>
              <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                {state.next.group.course.name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatClassDateShort(state.next.startAt)} ·{' '}
                {formatClassScheduleLabel(
                  state.next.startAt,
                  state.next.endAt,
                )}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Grupo</dt>
                  <dd className="font-medium">{state.next.group.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Modalidad</dt>
                  <dd className="font-medium">
                    {serviceTypeLabel(state.next.group.course.serviceType)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Enlace</dt>
                  <dd className="font-medium">
                    {state.next.meetingUrl ? (
                      <a
                        href={state.next.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Unirse a la clase
                      </a>
                    ) : (
                      'Sin meeting URL todavía'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Detalle</dt>
                  <dd className="font-medium">
                    <Link
                      href={`/dashboard/classes/${state.next.id}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Asistencia y notas
                    </Link>
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
          {state.status === 'ready' && !state.next ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No tenés clases próximas.
            </p>
          ) : null}
        </div>

        {state.status === 'ready' ? (
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <p className="text-sm font-semibold text-primary">Resumen del día</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.todayCount === 0
                ? 'Hoy no tenés clases programadas.'
                : state.todayCount === 1
                  ? 'Tenés 1 clase programada para hoy.'
                  : `Tenés ${state.todayCount} clases programadas para hoy.`}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dashboard/teacher/classes"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Mis clases
          </Link>
          <Link
            href="/dashboard/teacher/students"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Mis alumnos
          </Link>
          <Link
            href="/dashboard/teacher/materials"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Materiales
          </Link>
          <Link
            href="/dashboard/teacher/attendance"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Asistencia
          </Link>
          <Link
            href="/dashboard/teacher/earnings"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Earnings
          </Link>
        </div>
      </section>
    </DashboardShell>
  )
}
