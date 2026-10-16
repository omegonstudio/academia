'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Loader2,
} from 'lucide-react'
import type { PublicOnlineCourse, SessionUser } from '@academia/shared'
import { Alert, Button, Skeleton } from '@/components/ui/primitives'
import {
  enrollFreeOnlineCourseBrowser,
  getPublicOnlineCourseBrowser,
  getSessionBrowser,
  getStudentOnlineCourseOutlineBrowser,
} from '@/lib/api-browser'
import {
  formatLessonAssetKinds,
  formatOnlineCoursePrice,
  lessonHasListedContent,
} from '@/lib/online-course-media'
import { useRouter } from 'next/navigation'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code?: number }
  | { status: 'ready'; course: PublicOnlineCourse }

export default function PublicOnlineCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [session, setSession] = useState<SessionUser | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({})
  const [enrolling, setEnrolling] = useState(false)
  const [ctaError, setCtaError] = useState('')
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    const result = await getPublicOnlineCourseBrowser(slug)
    if (!result.ok) {
      setState({
        status: 'error',
        message: result.message,
        code: result.status,
      })
      return
    }
    setState({ status: 'ready', course: result.data })
    const first = result.data.modules[0]
    if (first) setOpenModules({ [first.id]: true })
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await getSessionBrowser()
      if (cancelled) return
      setSessionReady(true)
      if (result.ok) setSession(result.data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!sessionReady || session?.role !== 'STUDENT') return
    let cancelled = false
    void (async () => {
      const outline = await getStudentOnlineCourseOutlineBrowser(slug)
      if (cancelled) return
      if (outline.ok) setAlreadyEnrolled(true)
    })()
    return () => {
      cancelled = true
    }
  }, [session, sessionReady, slug])

  async function handleFreeEnroll() {
    if (enrolling) return
    setCtaError('')
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(`/cursos/${slug}`)}`)
      return
    }
    if (session.role !== 'STUDENT') {
      setCtaError('Solo los estudiantes pueden inscribirse a cursos online.')
      return
    }
    if (alreadyEnrolled) {
      router.push(`/dashboard/student/courses/${slug}`)
      return
    }
    setEnrolling(true)
    const result = await enrollFreeOnlineCourseBrowser(slug)
    setEnrolling(false)
    if (!result.ok) {
      if (result.status === 409) {
        router.push(`/dashboard/student/courses/${slug}`)
        return
      }
      setCtaError(result.message)
      return
    }
    router.push(`/dashboard/student/courses/${slug}`)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight">
            Academia<span className="text-primary">.</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/cursos"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Catálogo
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Ingresar
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-16 lg:px-8">
        {state.status === 'loading' ? (
          <div className="space-y-4">
            <Skeleton className="h-56 w-full rounded-3xl" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div className="mt-10 space-y-4">
            <Alert>
              {state.code === 404
                ? 'No encontramos este curso o todavía no está publicado.'
                : state.message}
            </Alert>
            <Link
              href="/cursos"
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              Volver al catálogo
            </Link>
          </div>
        ) : null}

        {state.status === 'ready' ? (
          <article>
            {state.course.coverImageUrl ? (
              <img
                src={state.course.coverImageUrl}
                alt=""
                className="mb-8 h-48 w-full rounded-3xl object-cover sm:h-64"
              />
            ) : (
              <div className="mb-8 flex h-40 items-end rounded-3xl bg-gradient-to-br from-primary/15 via-surface to-accent/10 p-6 sm:h-52">
                <p className="text-sm font-semibold text-primary">Curso online</p>
              </div>
            )}

            <p className="text-sm font-semibold text-primary">Curso online</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {state.course.title}
            </h1>
            {state.course.subtitle ? (
              <p className="mt-3 text-lg text-muted-foreground">
                {state.course.subtitle}
              </p>
            ) : null}
            {state.course.authorName ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Con {state.course.authorName}
              </p>
            ) : null}
            {(() => {
              const moduleCount = state.course.modules.length
              const lessonCount = state.course.modules.reduce(
                (sum, mod) => sum + mod.lessons.length,
                0,
              )
              return (
                <p className="mt-3 text-sm text-muted-foreground">
                  {moduleCount} {moduleCount === 1 ? 'módulo' : 'módulos'} ·{' '}
                  {lessonCount} {lessonCount === 1 ? 'lección' : 'lecciones'}
                </p>
              )
            })()}

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-2xl font-semibold">
                  {formatOnlineCoursePrice(
                    state.course.amountMinor,
                    state.course.currency,
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {state.course.isFree
                    ? 'Inscripción gratuita para estudiantes.'
                    : 'La inscripción paga se gestiona con la academia.'}
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                {state.course.isFree ? (
                  <Button
                    disabled={enrolling || !sessionReady}
                    onClick={() => void handleFreeEnroll()}
                  >
                    {enrolling ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Inscribiendo…
                      </>
                    ) : alreadyEnrolled ? (
                      'Ir al curso'
                    ) : session ? (
                      'Inscribite gratis'
                    ) : (
                      'Ingresá para inscribirte'
                    )}
                  </Button>
                ) : (
                  <>
                    <p className="max-w-xs text-sm text-muted-foreground sm:text-right">
                      Contactá a la academia para inscribirte. El pago online
                      llega en una próxima etapa.
                    </p>
                    <Link
                      href={`/login?next=${encodeURIComponent(`/cursos/${slug}`)}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                    >
                      Ingresá a tu cuenta
                    </Link>
                  </>
                )}
                {ctaError ? <Alert>{ctaError}</Alert> : null}
              </div>
            </div>

            {state.course.description ? (
              <section className="mt-10">
                <h2 className="text-xl font-semibold">Sobre el curso</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {state.course.description}
                </p>
              </section>
            ) : null}

            {state.course.benefits.length > 0 ? (
              <section className="mt-10">
                <h2 className="text-xl font-semibold">Qué vas a lograr</h2>
                <ul className="mt-4 space-y-2">
                  {state.course.benefits.map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {state.course.bonus.length > 0 ? (
              <section className="mt-10">
                <h2 className="text-xl font-semibold">Bonos</h2>
                <ul className="mt-4 space-y-2">
                  {state.course.bonus.map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="mt-10">
              <h2 className="text-xl font-semibold">Contenido</h2>
              {state.course.modules.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  El temario se publica pronto.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
                  {state.course.modules.map((mod, moduleIndex) => {
                    const open = openModules[mod.id] ?? false
                    return (
                      <li key={mod.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-4 text-left"
                          onClick={() =>
                            setOpenModules((current) => ({
                              ...current,
                              [mod.id]: !open,
                            }))
                          }
                          aria-expanded={open}
                        >
                          {open ? (
                            <ChevronDown className="size-4 shrink-0" />
                          ) : (
                            <ChevronRight className="size-4 shrink-0" />
                          )}
                          <span className="font-medium">
                            <span className="mr-2 text-muted-foreground">
                              {moduleIndex + 1}.
                            </span>
                            {mod.title}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {mod.lessons.length} lecciones
                          </span>
                        </button>
                        {open ? (
                          <ul className="space-y-2 px-4 pb-4 pl-10">
                            {mod.lessons.map((lesson, lessonIndex) => {
                              const pending = !lessonHasListedContent(
                                lesson.assetKinds,
                              )
                              return (
                                <li
                                  key={lesson.id}
                                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
                                >
                                  <span className="text-muted-foreground">
                                    {moduleIndex + 1}.{lessonIndex + 1}
                                  </span>
                                  <span>{lesson.title}</span>
                                  <span
                                    className={
                                      pending
                                        ? 'text-xs text-muted-foreground/80'
                                        : 'text-xs text-muted-foreground'
                                    }
                                  >
                                    {formatLessonAssetKinds(lesson.assetKinds)}
                                    {lesson.estimatedMinutes
                                      ? ` · ${lesson.estimatedMinutes} min`
                                      : ''}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </article>
        ) : null}
      </div>
    </main>
  )
}
