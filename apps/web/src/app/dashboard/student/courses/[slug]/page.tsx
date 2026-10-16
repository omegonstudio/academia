'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Circle,
} from 'lucide-react'
import type {
  OnlineQuizAttemptResult,
  OnlineQuizPublic,
  StudentOnlineCourseOutline,
  StudentOnlineLessonDetail,
} from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import {
  Alert,
  Button,
  Card,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives'
import {
  downloadStudentOnlineLessonAssetBrowser,
  getStudentOnlineCourseOutlineBrowser,
  getStudentOnlineLessonBrowser,
  getStudentOnlineLessonQuizBrowser,
  submitStudentOnlineLessonQuizBrowser,
  updateStudentOnlineLessonProgressBrowser,
} from '@/lib/api-browser'
import { videoEmbedUrl } from '@/lib/online-course-media'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; outline: StudentOnlineCourseOutline }

export default function StudentOnlineCourseViewerPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const user = useSessionUser()
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [lessonDetail, setLessonDetail] =
    useState<StudentOnlineLessonDetail | null>(null)
  const [lessonLoading, setLessonLoading] = useState(false)
  const [lessonError, setLessonError] = useState('')
  const [completing, setCompleting] = useState(false)
  const [quiz, setQuiz] = useState<OnlineQuizPublic | null>(null)
  const [quizResult, setQuizResult] = useState<OnlineQuizAttemptResult | null>(
    null,
  )
  const [quizAnswers, setQuizAnswers] = useState<
    Record<string, { selectedOptionIds?: string[]; textAnswer?: string }>
  >({})
  const [quizBusy, setQuizBusy] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({})

  const loadOutline = useCallback(async () => {
    setState({ status: 'loading' })
    const result = await getStudentOnlineCourseOutlineBrowser(slug)
    if (!result.ok) {
      setState({ status: 'error', message: result.message })
      return
    }
    setState({ status: 'ready', outline: result.data })
    setOpenModules((current) => {
      if (Object.keys(current).length > 0) return current
      const first = result.data.modules[0]
      return first ? { [first.module.id]: true } : {}
    })
    setSelectedLessonId((current) => {
      if (current) return current
      const firstUnlocked = result.data.modules
        .flatMap((m) => m.lessons)
        .find((entry) => !entry.locked)
      return firstUnlocked?.lesson.id ?? null
    })
  }, [slug])

  useEffect(() => {
    if (user.role !== 'STUDENT') {
      router.replace('/dashboard')
      return
    }
    void loadOutline()
  }, [user.role, router, loadOutline])

  const loadLesson = useCallback(
    async (lessonId: string) => {
      setLessonLoading(true)
      setLessonError('')
      setQuiz(null)
      setQuizResult(null)
      setQuizAnswers({})
      const [detail, quizResult] = await Promise.all([
        getStudentOnlineLessonBrowser(slug, lessonId),
        getStudentOnlineLessonQuizBrowser(slug, lessonId),
      ])
      setLessonLoading(false)
      if (!detail.ok) {
        setLessonDetail(null)
        setLessonError(detail.message)
        return
      }
      setLessonDetail(detail.data)
      if (quizResult.ok) setQuiz(quizResult.data)
      if (detail.data.progress?.status !== 'COMPLETED') {
        void updateStudentOnlineLessonProgressBrowser(slug, lessonId, {
          status: 'IN_PROGRESS',
        })
      }
    },
    [slug],
  )

  useEffect(() => {
    if (!selectedLessonId) return
    void loadLesson(selectedLessonId)
  }, [selectedLessonId, loadLesson])

  function isLessonLocked(lessonId: string | null): boolean {
    if (!lessonId || state.status !== 'ready') return true
    return (
      state.outline.modules
        .flatMap((m) => m.lessons)
        .find((e) => e.lesson.id === lessonId)?.locked ?? true
    )
  }

  async function markComplete() {
    if (!selectedLessonId || completing) return
    setCompleting(true)
    const result = await updateStudentOnlineLessonProgressBrowser(
      slug,
      selectedLessonId,
      { status: 'COMPLETED' },
    )
    setCompleting(false)
    if (!result.ok) {
      setLessonError(result.message)
      return
    }
    await loadOutline()
    if (lessonDetail) {
      setLessonDetail({ ...lessonDetail, progress: result.data })
    }
  }

  async function downloadAsset(assetId: string) {
    const result = await downloadStudentOnlineLessonAssetBrowser(assetId)
    if (!result.ok) {
      setLessonError(result.message)
      return
    }
    const url = result.data.downloadUrl ?? result.data.externalUrl
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function submitQuiz() {
    if (!selectedLessonId || !quiz || quizBusy) return
    setQuizBusy(true)
    setLessonError('')
    const answers = quiz.questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: quizAnswers[q.id]?.selectedOptionIds,
      textAnswer: quizAnswers[q.id]?.textAnswer,
    }))
    const result = await submitStudentOnlineLessonQuizBrowser(
      slug,
      selectedLessonId,
      { answers },
    )
    setQuizBusy(false)
    if (!result.ok) {
      setLessonError(result.message)
      return
    }
    setQuizResult(result.data)
    await loadOutline()
  }

  function selectLesson(lessonId: string | null) {
    if (!lessonId || isLessonLocked(lessonId)) return
    if (state.status === 'ready') {
      const owner = state.outline.modules.find((block) =>
        block.lessons.some((entry) => entry.lesson.id === lessonId),
      )
      if (owner) {
        setOpenModules((current) => ({
          ...current,
          [owner.module.id]: true,
        }))
      }
    }
    setSelectedLessonId(lessonId)
    setMobileNavOpen(false)
  }

  const flatLessons =
    state.status === 'ready'
      ? state.outline.modules.flatMap((block) => block.lessons)
      : []
  const currentLessonIndex = flatLessons.findIndex(
    (entry) => entry.lesson.id === selectedLessonId,
  )
  const lessonPositionLabel =
    currentLessonIndex >= 0
      ? `Lección ${currentLessonIndex + 1} de ${flatLessons.length}`
      : null

  const nav = state.status === 'ready' ? (
    <nav className="space-y-2">
      {state.outline.modules.map((block, moduleIndex) => {
        const open = openModules[block.module.id] ?? false
        return (
          <div key={block.module.id}>
            <button
              type="button"
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-surface-muted"
              onClick={() =>
                setOpenModules((current) => ({
                  ...current,
                  [block.module.id]: !open,
                }))
              }
              aria-expanded={open}
            >
              {open ? (
                <ChevronRight className="size-3.5 shrink-0 rotate-90 transition" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 transition" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {moduleIndex + 1}. {block.module.title}
              </span>
            </button>
            {open ? (
              <ul className="space-y-1">
                {block.lessons.map((entry) => {
                  const active = entry.lesson.id === selectedLessonId
                  const done = entry.progress?.status === 'COMPLETED'
                  return (
                    <li key={entry.lesson.id}>
                      <button
                        type="button"
                        disabled={entry.locked}
                        onClick={() => selectLesson(entry.lesson.id)}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                          active
                            ? 'bg-primary/12 text-primary'
                            : entry.locked
                              ? 'cursor-not-allowed text-muted-foreground/60'
                              : 'hover:bg-surface-muted'
                        }`}
                      >
                        {entry.locked ? (
                          <Lock className="size-4 shrink-0" />
                        ) : done ? (
                          <CheckCircle2 className="size-4 shrink-0 text-success" />
                        ) : (
                          <Circle className="size-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {entry.lesson.title}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        )
      })}
    </nav>
  ) : null

  return (
    <DashboardShell title="Curso online">
      {state.status === 'loading' ? (
        <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
      ) : null}
      {state.status === 'error' ? (
        <div className="mt-6 space-y-4">
          <Alert tone="danger">{state.message}</Alert>
          <Link
            href="/dashboard/student/courses"
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            Volver a mis cursos
          </Link>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <PageHeader
            eyebrow="Curso online"
            title={state.outline.course.title}
            description={
              state.outline.course.subtitle ??
              'Avanzá a tu ritmo por módulos y lecciones.'
            }
            action={
              <Link
                href="/dashboard/student/courses"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
              >
                <ArrowLeft className="size-4" />
                Mis cursos
              </Link>
            }
          />

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Progreso del curso</span>
              <span>{Math.round(state.outline.progressPercent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.min(100, Math.max(0, state.outline.progressPercent))}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-4 lg:hidden">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              {mobileNavOpen ? 'Ocultar temario' : 'Ver temario'}
            </Button>
            {mobileNavOpen ? (
              <Card className="mt-3 max-h-80 overflow-y-auto p-4">{nav}</Card>
            ) : null}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
            <Card className="hidden max-h-[70vh] overflow-y-auto p-4 lg:block">
              {nav}
            </Card>

            <Card className="p-5">
              {lessonLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : null}
              {lessonError ? (
                <div className="mb-4">
                  <Alert>{lessonError}</Alert>
                </div>
              ) : null}
              {!lessonLoading && lessonDetail ? (
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl font-semibold">
                      {lessonDetail.lesson.title}
                    </h2>
                    {lessonPositionLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {lessonPositionLabel}
                      </p>
                    ) : null}
                  </div>
                  {lessonDetail.lesson.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {lessonDetail.lesson.description}
                    </p>
                  ) : null}

                  {(() => {
                    const activeAssets = lessonDetail.assets.filter(
                      (a) => a.isActive,
                    )
                    const hasContent =
                      activeAssets.length > 0 || Boolean(quiz)
                    if (hasContent) return null
                    return (
                      <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface-muted/40 px-5 py-10 text-center">
                        <p className="font-medium">
                          Este contenido estará disponible próximamente.
                        </p>
                        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                          La lección «{lessonDetail.lesson.title}» ya forma
                          parte del programa. El material se va a publicar
                          cuando esté listo.
                        </p>
                      </div>
                    )
                  })()}

                  <div className="mt-6 space-y-6">
                    {lessonDetail.assets
                      .filter((a) => a.isActive)
                      .map((asset) => {
                        if (asset.kind === 'TEXT') {
                          return (
                            <section key={asset.id}>
                              <h3 className="text-sm font-semibold">
                                {asset.title}
                              </h3>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                                {asset.bodyText}
                              </p>
                            </section>
                          )
                        }
                        if (asset.kind === 'LINK') {
                          return (
                            <section key={asset.id}>
                              <h3 className="text-sm font-semibold">
                                {asset.title}
                              </h3>
                              {asset.externalUrl ? (
                                <a
                                  href={asset.externalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline"
                                >
                                  Abrir enlace
                                </a>
                              ) : null}
                            </section>
                          )
                        }
                        if (asset.kind === 'VIDEO') {
                          const embed = asset.externalUrl
                            ? videoEmbedUrl(asset.externalUrl)
                            : null
                          return (
                            <section key={asset.id}>
                              <h3 className="text-sm font-semibold">
                                {asset.title}
                              </h3>
                              {embed ? (
                                <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-border">
                                  <iframe
                                    src={embed}
                                    title={asset.title}
                                    className="h-full w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              ) : asset.externalUrl ? (
                                <a
                                  href={asset.externalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline"
                                >
                                  Ver video
                                </a>
                              ) : null}
                            </section>
                          )
                        }
                        if (asset.kind === 'DOCUMENT') {
                          return (
                            <section key={asset.id}>
                              <h3 className="text-sm font-semibold">
                                {asset.title}
                              </h3>
                              <Button
                                className="mt-2"
                                size="sm"
                                variant="outline"
                                onClick={() => void downloadAsset(asset.id)}
                              >
                                <Download className="size-4" />
                                Descargar
                              </Button>
                            </section>
                          )
                        }
                        return null
                      })}
                  </div>

                  {quiz ? (
                    <section className="mt-8 border-t border-border pt-6">
                      <h3 className="text-lg font-semibold">{quiz.title}</h3>
                      {quiz.passScorePercent !== null &&
                      quiz.passScorePercent !== undefined ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Para aprobar necesitás {quiz.passScorePercent}%.
                        </p>
                      ) : null}
                      <div className="mt-4 space-y-5">
                        {quiz.questions.map((question) => (
                          <fieldset key={question.id} className="space-y-2">
                            <legend className="text-sm font-medium">
                              {question.prompt}
                            </legend>
                            {question.type === 'SHORT_TEXT' ? (
                              <Textarea
                                value={
                                  quizAnswers[question.id]?.textAnswer ?? ''
                                }
                                onChange={(e) =>
                                  setQuizAnswers((current) => ({
                                    ...current,
                                    [question.id]: {
                                      textAnswer: e.target.value,
                                    },
                                  }))
                                }
                                disabled={Boolean(quizResult)}
                              />
                            ) : null}
                            {question.type === 'TRUE_FALSE' ||
                            question.type === 'SINGLE_CHOICE' ? (
                              <div className="space-y-2">
                                {question.options.map((option) => (
                                  <label
                                    key={option.id}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <input
                                      type="radio"
                                      name={question.id}
                                      checked={
                                        quizAnswers[question.id]
                                          ?.selectedOptionIds?.[0] === option.id
                                      }
                                      disabled={Boolean(quizResult)}
                                      onChange={() =>
                                        setQuizAnswers((current) => ({
                                          ...current,
                                          [question.id]: {
                                            selectedOptionIds: [option.id],
                                          },
                                        }))
                                      }
                                    />
                                    {option.label}
                                  </label>
                                ))}
                              </div>
                            ) : null}
                            {question.type === 'MULTIPLE_CHOICE' ? (
                              <div className="space-y-2">
                                {question.options.map((option) => {
                                  const selected =
                                    quizAnswers[
                                      question.id
                                    ]?.selectedOptionIds?.includes(option.id) ??
                                    false
                                  return (
                                    <label
                                      key={option.id}
                                      className="flex items-center gap-2 text-sm"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        disabled={Boolean(quizResult)}
                                        onChange={() =>
                                          setQuizAnswers((current) => {
                                            const prev =
                                              current[question.id]
                                                ?.selectedOptionIds ?? []
                                            const next = selected
                                              ? prev.filter(
                                                  (id) => id !== option.id,
                                                )
                                              : [...prev, option.id]
                                            return {
                                              ...current,
                                              [question.id]: {
                                                selectedOptionIds: next,
                                              },
                                            }
                                          })
                                        }
                                      />
                                      {option.label}
                                    </label>
                                  )
                                })}
                              </div>
                            ) : null}
                            {quizResult ? (
                              <p className="text-xs text-muted-foreground">
                                {quizResult.results.find(
                                  (r) => r.questionId === question.id,
                                )?.correct
                                  ? 'Correcta'
                                  : 'Incorrecta'}
                                {quizResult.results.find(
                                  (r) => r.questionId === question.id,
                                )?.explanation
                                  ? ` — ${
                                      quizResult.results.find(
                                        (r) => r.questionId === question.id,
                                      )?.explanation
                                    }`
                                  : ''}
                              </p>
                            ) : null}
                          </fieldset>
                        ))}
                      </div>
                      {!quizResult ? (
                        <Button
                          className="mt-4"
                          disabled={quizBusy}
                          onClick={() => void submitQuiz()}
                        >
                          {quizBusy ? 'Enviando…' : 'Enviar quiz'}
                        </Button>
                      ) : (
                        <div className="mt-4">
                          <Alert
                            tone={quizResult.passed ? 'success' : 'danger'}
                          >
                            Obtuviste {quizResult.scorePercent}%.{' '}
                            {quizResult.passed
                              ? '¡Aprobaste!'
                              : 'No alcanzaste el puntaje mínimo.'}
                          </Alert>
                        </div>
                      )}
                    </section>
                  ) : null}

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          !lessonDetail.previousLessonId ||
                          isLessonLocked(lessonDetail.previousLessonId)
                        }
                        onClick={() =>
                          selectLesson(lessonDetail.previousLessonId)
                        }
                      >
                        <ChevronLeft className="size-4" />
                        Lección anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          !lessonDetail.nextLessonId ||
                          isLessonLocked(lessonDetail.nextLessonId)
                        }
                        onClick={() => selectLesson(lessonDetail.nextLessonId)}
                      >
                        Siguiente lección
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                    {lessonDetail.progress?.status !== 'COMPLETED' ? (
                      <Button
                        disabled={completing}
                        onClick={() => void markComplete()}
                      >
                        {completing ? 'Guardando…' : 'Marcar como completa'}
                      </Button>
                    ) : (
                      <p className="text-sm font-medium text-success">
                        Lección completa
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
              {!lessonLoading && !lessonDetail && !lessonError ? (
                <p className="text-sm text-muted-foreground">
                  Seleccioná una lección del temario para empezar.
                </p>
              ) : null}
            </Card>
          </div>
        </>
      ) : null}
    </DashboardShell>
  )
}
