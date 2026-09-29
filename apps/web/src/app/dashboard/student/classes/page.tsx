'use client'

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
  partitionClasses,
  serviceTypeLabel,
  studentHubClassRange,
  teacherDisplayName,
} from '@/lib/student-hub'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      upcoming: ClassSessionCalendarEvent[]
      past: ClassSessionCalendarEvent[]
    }

function ClassList({
  title,
  empty,
  events,
}: {
  title: string
  empty: string
  events: ClassSessionCalendarEvent[]
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {events.map((event) => (
            <li key={event.id} className="px-4 py-4 sm:px-5">
              <p className="font-medium">{event.group.course.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatClassDateShort(event.startAt)} ·{' '}
                {formatClassScheduleLabel(event.startAt, event.endAt)} ·{' '}
                {serviceTypeLabel(event.group.course.serviceType)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {teacherDisplayName(event.teacher)}
                {event.meetingUrl ? (
                  <>
                    {' · '}
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Meeting
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function StudentClassesPage() {
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
      const parts = partitionClasses(result.data.classSessions)
      setState({ status: 'ready', ...parts })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  return (
    <DashboardShell title="Mis clases">
      <PageHeader
        eyebrow="Estudiante"
        title="Mis clases"
        description="Solo ves las clases de los grupos en los que estás matriculado."
      />
      {state.status === 'loading' ? (
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
      ) : null}
      {state.status === 'error' ? (
        <div className="mt-6"><Alert tone="danger">
          {state.message}
        </Alert></div>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <ClassList
            title="Próximas"
            empty="No tenés clases próximas en este período."
            events={state.upcoming}
          />
          <ClassList
            title="Pasadas"
            empty="Todavía no hay clases pasadas en este período."
            events={state.past}
          />
        </>
      ) : null}
    </DashboardShell>
  )
}
