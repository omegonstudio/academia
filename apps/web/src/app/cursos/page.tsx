'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { PublicOnlineCourseListResponse } from '@academia/shared'
import { PublicSiteFooter } from '@/components/public/site-footer'
import { PublicSiteHeader } from '@/components/public/site-header'
import {
  Alert,
  Button,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives'
import { listPublicOnlineCoursesBrowser } from '@/lib/api-browser'
import { formatOnlineCoursePrice } from '@/lib/online-course-media'

type CatalogCourse = PublicOnlineCourseListResponse['courses'][number]

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; courses: CatalogCourse[] }

export default function PublicOnlineCoursesCatalogPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    const result = await listPublicOnlineCoursesBrowser()
    if (!result.ok) {
      setState({ status: 'error', message: result.message })
      return
    }
    setState({ status: 'ready', courses: result.data })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <PublicSiteHeader activePath="/cursos" />

      <div className="mx-auto max-w-6xl px-5 pb-16 lg:px-8">
        <p className="text-sm font-semibold text-primary">Cursos online</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Aprendé a tu ritmo
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Cursos asíncronos con módulos y lecciones. El contenido multimedia se
          incorpora de forma progresiva.
        </p>

        {state.status === 'loading' ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div className="mt-10 space-y-4">
            <Alert>{state.message}</Alert>
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {state.status === 'ready' && state.courses.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="Todavía no hay cursos publicados."
              description="Cuando un curso pase a publicado, va a aparecer acá automáticamente."
              action={
                <Link
                  href="/"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
                >
                  Volver al inicio
                </Link>
              }
            />
          </div>
        ) : null}

        {state.status === 'ready' && state.courses.length > 0 ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {state.courses.map((course) => (
              <li key={course.id}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
                  {course.coverImageUrl ? (
                    <img
                      src={course.coverImageUrl}
                      alt=""
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-end bg-gradient-to-br from-primary/15 via-surface to-accent/10 p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Curso online
                      </p>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {course.title}
                    </h2>
                    {course.authorName ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Con {course.authorName}
                      </p>
                    ) : null}
                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                      {course.subtitle ||
                        course.description ||
                        'Curso online de la Academia.'}
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                      <p className="text-sm font-semibold">
                        {formatOnlineCoursePrice(
                          course.amountMinor,
                          course.currency,
                        )}
                      </p>
                      <Link
                        href={`/cursos/${course.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:underline"
                      >
                        Ver curso
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <PublicSiteFooter />
    </main>
  )
}
