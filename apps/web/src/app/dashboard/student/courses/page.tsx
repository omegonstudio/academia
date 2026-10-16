'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import type { OnlineCourse } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import {
  Alert,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives'
import {
  getStudentOnlineCourseOutlineBrowser,
  listStudentOnlineCoursesBrowser,
} from '@/lib/api-browser'

type CourseRow = {
  course: OnlineCourse
  progressPercent: number
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: CourseRow[] }

export default function StudentOnlineCoursesPage() {
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
      const list = await listStudentOnlineCoursesBrowser()
      if (cancelled) return
      if (!list.ok) {
        setState({ status: 'error', message: list.message })
        return
      }
      const outlines = await Promise.all(
        list.data.map(async (course) => {
          const outline = await getStudentOnlineCourseOutlineBrowser(
            course.slug,
          )
          return {
            course,
            progressPercent: outline.ok ? outline.data.progressPercent : 0,
          }
        }),
      )
      if (cancelled) return
      setState({ status: 'ready', rows: outlines })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  return (
    <DashboardShell title="Cursos online">
      <PageHeader
        eyebrow="Estudiante"
        title="Cursos online"
        description="Los cursos en los que tenés acceso, con tu progreso."
      />
      {state.status === 'loading' ? (
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
      ) : null}
      {state.status === 'error' ? (
        <div className="mt-6">
          <Alert tone="danger">{state.message}</Alert>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        state.rows.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No tenés cursos online todavía."
              description="Cuando te inscribas a un curso publicado, lo vas a ver acá."
            />
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {state.rows.map(({ course, progressPercent }) => (
              <li key={course.id}>
                <Link
                  href={`/dashboard/student/courses/${course.slug}`}
                  className="block rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BookOpen className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold">{course.title}</h2>
                      {course.subtitle ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {course.subtitle}
                        </p>
                      ) : null}
                      <div className="mt-4">
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>Progreso</span>
                          <span>{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </DashboardShell>
  )
}
