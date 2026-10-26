'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { PublicOnlineCourseListResponse } from '@academia/shared'
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { listPublicOnlineCoursesBrowser } from '@/lib/api-browser'
import { formatOnlineCoursePrice } from '@/lib/online-course-media'

type CatalogCourse = PublicOnlineCourseListResponse['courses'][number]

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; courses: CatalogCourse[] }

export function FeaturedCourses() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    const result = await listPublicOnlineCoursesBrowser()
    if (!result.ok) {
      setState({ status: 'error', message: result.message })
      return
    }
    setState({ status: 'ready', courses: result.data.slice(0, 4) })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section
      id="cursos-destacados"
      className="border-y border-border bg-surface py-20 lg:py-24"
      aria-labelledby="featured-courses-heading"
    >
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Cursos destacados</p>
            <h2
              id="featured-courses-heading"
              className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
            >
              Publicados en el catálogo
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Solo aparecen cursos con estado publicado. Los borradores del seed
              Spanish2Go no se muestran hasta que se publiquen.
            </p>
          </div>
          <Link
            href="/cursos"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            Ver catálogo completo
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {state.status === 'loading' ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
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
                  href="/cursos"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
                >
                  Ir al catálogo
                </Link>
              }
            />
          </div>
        ) : null}

        {state.status === 'ready' && state.courses.length > 0 ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {state.courses.map((course) => (
              <li key={course.id}>
                <article className="flex h-full flex-col rounded-2xl border border-border bg-background p-6">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {course.title}
                  </h3>
                  {course.authorName ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Con {course.authorName}
                    </p>
                  ) : null}
                  <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
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
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
