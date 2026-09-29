'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TeacherAttendanceItem } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Skeleton } from '@/components/ui/primitives'
import { listTeacherMeAttendanceBrowser, personFullName } from '@/lib/api-browser'
import { formatClassDateShort, formatClassTime } from '@/lib/class-session-display'
import {
  attendanceStatusLabel,
  teacherHubClassRange,
} from '@/lib/teacher-hub'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; attendances: TeacherAttendanceItem[] }

export default function TeacherAttendancePage() {
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
      const result = await listTeacherMeAttendanceBrowser(range.from, range.to)
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error', message: result.message })
        return
      }
      setState({ status: 'ready', attendances: result.data })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  return (
    <DashboardShell title="Asistencia">
      <PageHeader
        eyebrow="Profesor"
        title="Asistencia"
        description="Historial de asistencia de tus clases. Solo lectura."
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
        state.attendances.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Todavía no hay registros de asistencia en este período.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
            {state.attendances.map((row) => (
              <li key={row.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {personFullName(row.student)} ·{' '}
                    {row.classSession.group.course.name}
                  </p>
                  <p className="text-sm font-medium">
                    {attendanceStatusLabel(row.status)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatClassDateShort(row.classSession.startAt)} ·{' '}
                  {formatClassTime(row.classSession.startAt)} ·{' '}
                  {row.classSession.group.name}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </DashboardShell>
  )
}
