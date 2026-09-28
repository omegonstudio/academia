'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClassSessionCalendarEvent } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Skeleton } from '@/components/ui/primitives'
import { listClassSessionCalendarBrowser } from '@/lib/api-browser'
import {
  formatClassDateShort,
  formatClassScheduleLabel,
} from '@/lib/class-session-display'
import {
  pickNextClass,
  serviceTypeLabel,
  studentHubClassRange,
  teacherDisplayName,
} from '@/lib/student-hub'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; next: ClassSessionCalendarEvent | null }

export default function StudentDashboardPage() {
  const user = useSessionUser()
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (user.role !== 'STUDENT') {
      router.replace('/dashboard')
      return
    }
    let cancelled = false
    void (async () => {
      const range = studentHubClassRange()
      const result = await listClassSessionCalendarBrowser(range.from, range.to)
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error', message: result.message })
        return
      }
      setState({
        status: 'ready',
        next: pickNextClass(result.data.classSessions),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  return (
    <DashboardShell title="Mi espacio">
      <PageHeader
        eyebrow="Estudiante"
        title="Hola"
        description="Tu próxima clase, materiales y asistencia en un solo lugar."
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
                  <dt className="text-muted-foreground">Profesor</dt>
                  <dd className="font-medium">
                    {teacherDisplayName(state.next.teacher)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Modalidad</dt>
                  <dd className="font-medium">
                    {serviceTypeLabel(state.next.group.course.serviceType)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Grupo</dt>
                  <dd className="font-medium">{state.next.group.name}</dd>
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
              </dl>
            </>
          ) : null}
          {state.status === 'ready' && !state.next ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No tenés próximas clases programadas.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/dashboard/student/classes"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Mis clases
          </Link>
          <Link
            href="/dashboard/student/materials"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Materiales
          </Link>
          <Link
            href="/dashboard/student/attendance"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Asistencia
          </Link>
          <Link
            href="/dashboard/student/finance"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:border-primary/40"
          >
            Finanzas
          </Link>
        </div>
      </section>
    </DashboardShell>
  )
}
