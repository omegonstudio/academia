'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TeacherHubStudent } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Skeleton } from '@/components/ui/primitives'
import { listTeacherMeStudentsBrowser, personFullName } from '@/lib/api-browser'
import { serviceTypeLabel } from '@/lib/teacher-hub'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; students: TeacherHubStudent[] }

export default function TeacherStudentsPage() {
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
      const result = await listTeacherMeStudentsBrowser()
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error', message: result.message })
        return
      }
      setState({ status: 'ready', students: result.data })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  return (
    <DashboardShell title="Mis alumnos">
      <PageHeader
        eyebrow="Profesor"
        title="Mis alumnos"
        description="Estudiantes vinculados por asignación directa o por grupos que impartís."
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
        state.students.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No tenés alumnos asignados.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
            {state.students.map((student) => (
              <li key={student.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{personFullName(student)}</p>
                  <p className="text-sm text-muted-foreground">
                    Nivel {student.level}
                    {!student.isActive ? ' · Inactivo' : null}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {student.email}
                  {student.viaAssignment ? ' · Asignación directa' : null}
                </p>
                {student.groups.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {student.groups.map((group) => (
                      <li key={group.id}>
                        {group.name} · {group.course.name} ·{' '}
                        {serviceTypeLabel(group.course.serviceType)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Sin grupos activos en tus clases.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </DashboardShell>
  )
}
