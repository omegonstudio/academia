'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
} from 'lucide-react'
import {
  isMaterialAllowedMimeType,
  sanitizeOriginalFilename,
  type FinanceCurrency,
  type OnlineCourse,
  type OnlineCourseAccessMode,
  type OnlineLesson,
  type OnlineLessonAsset,
  type OnlineLessonStatus,
  type OnlineCourseModule,
  type OnlineQuizQuestionType,
} from '@academia/shared'
import {
  FINANCE_CURRENCIES,
  ONLINE_COURSE_ACCESS_MODES,
  ONLINE_LESSON_STATUSES,
  ONLINE_QUIZ_QUESTION_TYPES,
} from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives'
import {
  amountMinorToPriceMajor,
  archiveOnlineCourseBrowser,
  createOnlineCourseModuleBrowser,
  createOnlineLessonAssetBrowser,
  createOnlineLessonBrowser,
  deleteOnlineLessonAssetBrowser,
  getOnlineCourseBrowser,
  getOnlineQuizAdminBrowser,
  grantOnlineCourseAccessBrowser,
  listOnlineCourseModulesBrowser,
  listOnlineLessonAssetsBrowser,
  listOnlineLessonsBrowser,
  listStudentsBrowser,
  onlineCourseAccessModeLabels,
  onlineCourseStatusLabels,
  priceMajorToAmountMinor,
  publishOnlineCourseBrowser,
  reorderOnlineCourseModulesBrowser,
  reorderOnlineLessonsBrowser,
  unpublishOnlineCourseBrowser,
  updateOnlineCourseBrowser,
  updateOnlineLessonBrowser,
  uploadOnlineLessonDocumentBrowser,
  upsertOnlineQuizBrowser,
} from '@/lib/api-browser'
import type { Student } from '@academia/shared'
import { validateMaterialFile } from '@/lib/materials'

type ModuleBlock = {
  module: OnlineCourseModule
  lessons: OnlineLesson[]
  expanded: boolean
  loadingLessons: boolean
}

type NewLessonFormState = {
  title: string
  estimatedMinutes: string
  isRequired: boolean
  acceptsSubmission: boolean
  status: OnlineLessonStatus
}

const EMPTY_NEW_LESSON_FORM: NewLessonFormState = {
  title: '',
  estimatedMinutes: '',
  isRequired: true,
  acceptsSubmission: false,
  status: 'DRAFT',
}

function NewLessonForm({
  formId,
  value,
  error,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  formId: string
  value: NewLessonFormState
  error: string
  saving: boolean
  onChange: (next: NewLessonFormState) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const titleId = `${formId}-title`
  const minutesId = `${formId}-minutes`
  const statusId = `${formId}-status`

  return (
    <form
      className="mb-4 space-y-3 rounded-xl border border-border bg-surface-muted/40 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      aria-labelledby={`${formId}-heading`}
    >
      <h3 id={`${formId}-heading`} className="text-sm font-semibold">
        Nueva lección
      </h3>
      {error ? <Alert>{error}</Alert> : null}
      <Field
        label="Título"
        htmlFor={titleId}
        error={
          error && !value.title.trim()
            ? 'Ingresá el título de la lección.'
            : undefined
        }
      >
        <Input
          id={titleId}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Ej. Introducción al módulo"
          required
          autoFocus
          disabled={saving}
          aria-invalid={Boolean(error && !value.title.trim())}
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Field label="Duración (minutos)" htmlFor={minutesId}>
          <Input
            id={minutesId}
            className="w-28"
            type="number"
            min={1}
            value={value.estimatedMinutes}
            onChange={(e) =>
              onChange({ ...value, estimatedMinutes: e.target.value })
            }
            disabled={saving}
          />
        </Field>
        <Field label="Estado" htmlFor={statusId}>
          <Select
            id={statusId}
            className="w-auto"
            value={value.status}
            onChange={(e) =>
              onChange({
                ...value,
                status: e.target.value as OnlineLessonStatus,
              })
            }
            disabled={saving}
          >
            {ONLINE_LESSON_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'PUBLISHED' ? 'Publicada' : 'Borrador'}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={value.isRequired}
            onChange={(e) =>
              onChange({ ...value, isRequired: e.target.checked })
            }
            disabled={saving}
          />
          Lección obligatoria
        </label>
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={value.acceptsSubmission}
            onChange={(e) =>
              onChange({ ...value, acceptsSubmission: e.target.checked })
            }
            disabled={saving}
          />
          Acepta entregas
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving || !value.title.trim()}>
          {saving ? 'Creando…' : 'Crear lección'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function statusTone(
  status: OnlineCourse['status'],
): 'neutral' | 'success' | 'warning' {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

type DraftQuizOption = {
  clientKey: string
  id?: string
  label: string
  isCorrect: boolean
}

type DraftQuizQuestion = {
  clientKey: string
  id?: string
  prompt: string
  type: OnlineQuizQuestionType
  points: string
  correctText: string
  explanation: string
  options: DraftQuizOption[]
}

function newClientKey(): string {
  return `tmp-${crypto.randomUUID()}`
}

function emptyDraftQuestion(): DraftQuizQuestion {
  return {
    clientKey: newClientKey(),
    prompt: '',
    type: 'SINGLE_CHOICE',
    points: '1',
    correctText: '',
    explanation: '',
    options: [
      { clientKey: newClientKey(), label: '', isCorrect: true },
      { clientKey: newClientKey(), label: '', isCorrect: false },
    ],
  }
}

const QUIZ_TYPE_LABELS: Record<OnlineQuizQuestionType, string> = {
  SINGLE_CHOICE: 'Opción única',
  MULTIPLE_CHOICE: 'Opción múltiple',
  TRUE_FALSE: 'Verdadero / Falso',
  SHORT_TEXT: 'Texto corto',
}

function LessonQuizEditor({
  lessonId,
  onError,
  onSuccess,
}: {
  lessonId: string
  onError: (message: string) => void
  onSuccess: (message: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('Cuestionario')
  const [passScore, setPassScore] = useState('70')
  const [questions, setQuestions] = useState<DraftQuizQuestion[]>([
    emptyDraftQuestion(),
  ])
  const [attemptCount, setAttemptCount] = useState(0)
  const [hasExistingQuiz, setHasExistingQuiz] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLocalError('')
    const result = await getOnlineQuizAdminBrowser(lessonId)
    setLoading(false)
    if (!result.ok) {
      onError(result.message)
      return
    }
    if (!result.data) {
      setHasExistingQuiz(false)
      setAttemptCount(0)
      setTitle('Cuestionario')
      setPassScore('70')
      setQuestions([emptyDraftQuestion()])
      return
    }
    const quiz = result.data
    setHasExistingQuiz(true)
    setAttemptCount(quiz.attemptCount)
    setTitle(quiz.title)
    setPassScore(
      quiz.passScorePercent !== null ? String(quiz.passScorePercent) : '',
    )
    setQuestions(
      quiz.questions.map((q) => ({
        clientKey: q.id,
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        points: String(q.points),
        correctText: q.correctText ?? '',
        explanation: q.explanation ?? '',
        options:
          q.type === 'SHORT_TEXT'
            ? []
            : q.options.map((o) => ({
                clientKey: o.id,
                id: o.id,
                label: o.label,
                isCorrect: o.isCorrect,
              })),
      })),
    )
  }, [lessonId, onError])

  useEffect(() => {
    void load()
  }, [load])

  function updateQuestion(
    clientKey: string,
    patch: Partial<DraftQuizQuestion>,
  ) {
    setQuestions((current) =>
      current.map((q) => (q.clientKey === clientKey ? { ...q, ...patch } : q)),
    )
  }

  function moveQuestion(clientKey: string, direction: -1 | 1) {
    setQuestions((current) => {
      const index = current.findIndex((q) => q.clientKey === clientKey)
      if (index < 0) return current
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item!)
      return next
    })
  }

  function requestDeleteQuestion(clientKey: string) {
    const question = questions.find((q) => q.clientKey === clientKey)
    if (!question) return
    if (attemptCount > 0 && question.id) {
      setLocalError(
        'No se pueden eliminar preguntas de un cuestionario con intentos de alumnos.',
      )
      return
    }
    if (questions.length <= 1) {
      setLocalError('El cuestionario necesita al menos una pregunta.')
      return
    }
    setPendingDeleteKey(clientKey)
  }

  function confirmDeleteQuestion() {
    if (!pendingDeleteKey) return
    setQuestions((current) =>
      current.filter((q) => q.clientKey !== pendingDeleteKey),
    )
    setPendingDeleteKey(null)
  }

  function addOption(questionKey: string) {
    setQuestions((current) =>
      current.map((q) =>
        q.clientKey === questionKey
          ? {
              ...q,
              options: [
                ...q.options,
                {
                  clientKey: newClientKey(),
                  label: '',
                  isCorrect: false,
                },
              ],
            }
          : q,
      ),
    )
  }

  function removeOption(questionKey: string, optionKey: string) {
    const question = questions.find((q) => q.clientKey === questionKey)
    if (!question) return
    const option = question.options.find((o) => o.clientKey === optionKey)
    if (attemptCount > 0 && option?.id) {
      setLocalError(
        'No se pueden eliminar opciones de una pregunta con intentos de alumnos.',
      )
      return
    }
    if (question.options.length <= 2) {
      setLocalError('Cada pregunta de opciones necesita al menos dos.')
      return
    }
    setLocalError('')
    setQuestions((current) =>
      current.map((q) =>
        q.clientKey === questionKey
          ? {
              ...q,
              options: q.options.filter((o) => o.clientKey !== optionKey),
            }
          : q,
      ),
    )
  }

  async function saveQuiz() {
    if (saving) return
    setLocalError('')
    if (!title.trim()) {
      setLocalError('Ingresá un título para el cuestionario.')
      return
    }
    for (const [index, q] of questions.entries()) {
      if (!q.prompt.trim()) {
        setLocalError(`La pregunta ${index + 1} necesita enunciado.`)
        return
      }
      if (q.type === 'SHORT_TEXT') {
        if (!q.correctText.trim()) {
          setLocalError(
            `La pregunta ${index + 1} necesita la respuesta de texto esperada.`,
          )
          return
        }
      } else {
        if (q.options.some((o) => !o.label.trim())) {
          setLocalError(
            `Completá todas las opciones de la pregunta ${index + 1}.`,
          )
          return
        }
        const correctCount = q.options.filter((o) => o.isCorrect).length
        if (q.type === 'MULTIPLE_CHOICE' && correctCount < 1) {
          setLocalError(
            `La pregunta ${index + 1} necesita al menos una opción correcta.`,
          )
          return
        }
        if (q.type !== 'MULTIPLE_CHOICE' && correctCount !== 1) {
          setLocalError(
            `La pregunta ${index + 1} necesita exactamente una opción correcta.`,
          )
          return
        }
      }
    }

    setSaving(true)
    const pass =
      passScore.trim() === '' ? null : Number.parseInt(passScore.trim(), 10)
    const result = await upsertOnlineQuizBrowser(lessonId, {
      title: title.trim(),
      passScorePercent:
        pass !== null && Number.isFinite(pass) ? pass : null,
      questions: questions.map((q) => ({
        ...(q.id ? { id: q.id } : {}),
        prompt: q.prompt.trim(),
        type: q.type,
        points: Number.parseInt(q.points, 10) || 1,
        correctText:
          q.type === 'SHORT_TEXT' ? q.correctText.trim() : null,
        explanation: q.explanation.trim() || null,
        options:
          q.type === 'SHORT_TEXT'
            ? undefined
            : q.options.map((o) => ({
                ...(o.id ? { id: o.id } : {}),
                label: o.label.trim(),
                isCorrect: o.isCorrect,
              })),
      })),
    })
    setSaving(false)
    if (!result.ok) {
      setLocalError(result.message)
      onError(result.message)
      return
    }
    setHasExistingQuiz(true)
    setAttemptCount(result.data.attemptCount)
    setQuestions(
      result.data.questions.map((q) => ({
        clientKey: q.id,
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        points: String(q.points),
        correctText: q.correctText ?? '',
        explanation: q.explanation ?? '',
        options:
          q.type === 'SHORT_TEXT'
            ? []
            : q.options.map((o) => ({
                clientKey: o.id,
                id: o.id,
                label: o.label,
                isCorrect: o.isCorrect,
              })),
      })),
    )
    onSuccess('Cuestionario guardado.')
  }

  if (loading) {
    return <Skeleton className="mt-4 h-40 w-full" />
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-dashed border-border p-3">
      <div>
        <p className="text-sm font-medium">
          Cuestionario
          {hasExistingQuiz ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (guardado)
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (nuevo)
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Editá preguntas y opciones en el borrador local. Los cambios se
          persisten solo al guardar.
        </p>
      </div>

      {attemptCount > 0 ? (
        <Alert tone="info">
          Este cuestionario tiene {attemptCount} intento
          {attemptCount === 1 ? '' : 's'} de alumnos. Podés editar textos,
          puntajes y respuestas correctas, y agregar preguntas. No se pueden
          eliminar preguntas u opciones existentes ni cambiar el tipo.
        </Alert>
      ) : null}

      {localError ? <Alert>{localError}</Alert> : null}

      <div className="grid gap-2">
        <Field label="Título" htmlFor={`quiz-title-${lessonId}`}>
          <Input
            id={`quiz-title-${lessonId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field
          label="Nota mínima % (opcional)"
          htmlFor={`quiz-pass-${lessonId}`}
        >
          <Input
            id={`quiz-pass-${lessonId}`}
            inputMode="numeric"
            value={passScore}
            onChange={(e) => setPassScore(e.target.value)}
            placeholder="70"
          />
        </Field>
      </div>

      <ul className="space-y-4">
        {questions.map((question, index) => (
          <li
            key={question.clientKey}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Pregunta {index + 1}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Subir pregunta ${index + 1}`}
                  disabled={index === 0 || saving}
                  onClick={() => moveQuestion(question.clientKey, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Bajar pregunta ${index + 1}`}
                  disabled={index === questions.length - 1 || saving}
                  onClick={() => moveQuestion(question.clientKey, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => requestDeleteQuestion(question.clientKey)}
                >
                  Eliminar
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              <Field
                label="Enunciado"
                htmlFor={`quiz-prompt-${question.clientKey}`}
              >
                <Textarea
                  id={`quiz-prompt-${question.clientKey}`}
                  value={question.prompt}
                  onChange={(e) =>
                    updateQuestion(question.clientKey, {
                      prompt: e.target.value,
                    })
                  }
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field
                  label="Tipo"
                  htmlFor={`quiz-type-${question.clientKey}`}
                >
                  <Select
                    id={`quiz-type-${question.clientKey}`}
                    value={question.type}
                    disabled={Boolean(attemptCount > 0 && question.id)}
                    onChange={(e) => {
                      const type = e.target.value as OnlineQuizQuestionType
                      if (type === 'SHORT_TEXT') {
                        updateQuestion(question.clientKey, {
                          type,
                          options: [],
                        })
                        return
                      }
                      if (type === 'TRUE_FALSE') {
                        updateQuestion(question.clientKey, {
                          type,
                          options: [
                            {
                              clientKey: newClientKey(),
                              label: 'Verdadero',
                              isCorrect: true,
                            },
                            {
                              clientKey: newClientKey(),
                              label: 'Falso',
                              isCorrect: false,
                            },
                          ],
                        })
                        return
                      }
                      updateQuestion(question.clientKey, {
                        type,
                        options:
                          question.options.length >= 2
                            ? question.options
                            : emptyDraftQuestion().options,
                      })
                    }}
                  >
                    {ONLINE_QUIZ_QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {QUIZ_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Puntos"
                  htmlFor={`quiz-points-${question.clientKey}`}
                >
                  <Input
                    id={`quiz-points-${question.clientKey}`}
                    inputMode="numeric"
                    value={question.points}
                    onChange={(e) =>
                      updateQuestion(question.clientKey, {
                        points: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>

              {question.type === 'SHORT_TEXT' ? (
                <Field
                  label="Respuesta esperada"
                  htmlFor={`quiz-correct-text-${question.clientKey}`}
                >
                  <Input
                    id={`quiz-correct-text-${question.clientKey}`}
                    value={question.correctText}
                    onChange={(e) =>
                      updateQuestion(question.clientKey, {
                        correctText: e.target.value,
                      })
                    }
                  />
                </Field>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Opciones
                  </p>
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={option.clientKey}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Input
                        aria-label={`Opción ${optionIndex + 1}`}
                        className="min-w-[12rem] flex-1"
                        value={option.label}
                        onChange={(e) =>
                          updateQuestion(question.clientKey, {
                            options: question.options.map((o) =>
                              o.clientKey === option.clientKey
                                ? { ...o, label: e.target.value }
                                : o,
                            ),
                          })
                        }
                      />
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type={
                            question.type === 'MULTIPLE_CHOICE'
                              ? 'checkbox'
                              : 'radio'
                          }
                          name={`correct-${question.clientKey}`}
                          checked={option.isCorrect}
                          onChange={() =>
                            updateQuestion(question.clientKey, {
                              options: question.options.map((o) => {
                                if (question.type === 'MULTIPLE_CHOICE') {
                                  return o.clientKey === option.clientKey
                                    ? { ...o, isCorrect: !o.isCorrect }
                                    : o
                                }
                                return {
                                  ...o,
                                  isCorrect: o.clientKey === option.clientKey,
                                }
                              }),
                            })
                          }
                        />
                        Correcta
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() =>
                          removeOption(question.clientKey, option.clientKey)
                        }
                      >
                        Quitar
                      </Button>
                    </div>
                  ))}
                  {question.type !== 'TRUE_FALSE' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => addOption(question.clientKey)}
                    >
                      <Plus className="size-3.5" />
                      Opción
                    </Button>
                  ) : null}
                </div>
              )}

              <Field
                label="Explicación (opcional)"
                htmlFor={`quiz-expl-${question.clientKey}`}
              >
                <Input
                  id={`quiz-expl-${question.clientKey}`}
                  value={question.explanation}
                  onChange={(e) =>
                    updateQuestion(question.clientKey, {
                      explanation: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() =>
            setQuestions((current) => [...current, emptyDraftQuestion()])
          }
        >
          <Plus className="size-3.5" />
          Pregunta
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => void saveQuiz()}
        >
          {saving ? 'Guardando…' : 'Guardar cuestionario'}
        </Button>
      </div>

      {pendingDeleteKey ? (
        <ConfirmDialog
          title="Eliminar pregunta"
          description="Se quitará del borrador local. El cambio se confirma al guardar el cuestionario."
          confirmLabel="Eliminar"
          onConfirm={confirmDeleteQuestion}
          onClose={() => setPendingDeleteKey(null)}
        />
      ) : null}
    </div>
  )
}

function LessonAssets({
  lessonId,
  onError,
}: {
  lessonId: string
  onError: (message: string) => void
}) {
  const [assets, setAssets] = useState<OnlineLessonAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<'TEXT' | 'LINK' | 'VIDEO' | 'DOCUMENT'>('TEXT')
  const [title, setTitle] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await listOnlineLessonAssetsBrowser(lessonId)
    setLoading(false)
    if (!result.ok) {
      onError(result.message)
      return
    }
    setAssets(result.data.filter((a) => a.isActive))
  }, [lessonId, onError])

  useEffect(() => {
    void load()
  }, [load])

  async function addAsset(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!title.trim()) {
      onError('Ingresá un título para el contenido.')
      return
    }
    setBusy(true)
    setStatus(null)
    onError('')

    if (kind === 'DOCUMENT') {
      if (!file) {
        setBusy(false)
        onError('Seleccioná un archivo.')
        return
      }
      const fileError = validateMaterialFile(file)
      if (fileError) {
        setBusy(false)
        onError(fileError)
        return
      }
      const originalFilename = sanitizeOriginalFilename(file.name)
      if (!originalFilename || !isMaterialAllowedMimeType(file.type)) {
        setBusy(false)
        onError('Archivo no válido. Usá PDF, imagen o audio permitido.')
        return
      }
      setStatus('Subiendo documento…')
      const result = await uploadOnlineLessonDocumentBrowser(
        lessonId,
        {
          title: title.trim(),
          mimeType: file.type,
          sizeBytes: file.size,
          originalFilename,
        },
        file,
      )
      setBusy(false)
      setStatus(null)
      if (!result.ok) {
        onError(result.message)
        return
      }
    } else {
      const result = await createOnlineLessonAssetBrowser(lessonId, {
        kind,
        title: title.trim(),
        ...(kind === 'TEXT' ? { bodyText: bodyText.trim() } : {}),
        ...(kind === 'LINK' || kind === 'VIDEO'
          ? { externalUrl: externalUrl.trim() }
          : {}),
      })
      setBusy(false)
      if (!result.ok) {
        onError(result.message)
        return
      }
    }

    setTitle('')
    setBodyText('')
    setExternalUrl('')
    setFile(null)
    void load()
  }

  async function removeAsset(assetId: string) {
    if (busy) return
    setBusy(true)
    const result = await deleteOnlineLessonAssetBrowser(assetId)
    setBusy(false)
    if (!result.ok) {
      onError(result.message)
      return
    }
    void load()
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Contenidos
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-16 w-full" />
      ) : assets.length === 0 ? (
        <div className="mt-2 rounded-lg border border-dashed border-border bg-surface px-3 py-3">
          <p className="text-sm font-medium text-muted-foreground">
            Sin contenido
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta lección todavía no tiene video, documento, texto ni enlaces.
            Podés cargarlos cuando estén listos.
          </p>
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <span>
                <Badge className="mr-2" tone="info">
                  {asset.kind}
                </Badge>
                {asset.title}
                {asset.kind === 'DOCUMENT' && asset.uploadStatus !== 'READY'
                  ? ' (pendiente)'
                  : null}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void removeAsset(asset.id)}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addAsset} className="mt-3 grid gap-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as typeof kind)
            }
            aria-label="Tipo de contenido"
          >
            <option value="TEXT">Texto</option>
            <option value="LINK">Enlace</option>
            <option value="VIDEO">Video (URL)</option>
            <option value="DOCUMENT">Documento</option>
          </Select>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del contenido"
          />
        </div>
        {kind === 'TEXT' ? (
          <Textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Texto de la lección"
          />
        ) : null}
        {kind === 'LINK' || kind === 'VIDEO' ? (
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://…"
          />
        ) : null}
        {kind === 'DOCUMENT' ? (
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        ) : null}
        {status ? (
          <p className="text-xs text-muted-foreground">{status}</p>
        ) : null}
        <div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? 'Guardando…' : 'Agregar contenido'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function OnlineCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [course, setCourse] = useState<OnlineCourse | null>(null)
  const [modules, setModules] = useState<ModuleBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [publishIssues, setPublishIssues] = useState<string[]>([])
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [creatingLessonModuleId, setCreatingLessonModuleId] = useState<
    string | null
  >(null)
  const [newLessonForm, setNewLessonForm] = useState<NewLessonFormState>(
    EMPTY_NEW_LESSON_FORM,
  )
  const [newLessonError, setNewLessonError] = useState('')
  const [newLessonSaving, setNewLessonSaving] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [grantStudentId, setGrantStudentId] = useState('')
  const [editForm, setEditForm] = useState({
    title: '',
    slug: '',
    subtitle: '',
    description: '',
    coverImageUrl: '',
    benefits: '',
    bonus: '',
    price: '',
    currency: 'ARS' as FinanceCurrency,
    accessMode: 'OPEN' as OnlineCourseAccessMode,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [courseResult, modulesResult, studentsResult] = await Promise.all([
      getOnlineCourseBrowser(id),
      listOnlineCourseModulesBrowser(id),
      listStudentsBrowser(),
    ])
    setLoading(false)
    if (!courseResult.ok) {
      if (courseResult.status === 404) {
        setCourse(null)
        return
      }
      setError(courseResult.message)
      return
    }
    setCourse(courseResult.data)
    setEditForm({
      title: courseResult.data.title,
      slug: courseResult.data.slug,
      subtitle: courseResult.data.subtitle ?? '',
      description: courseResult.data.description ?? '',
      coverImageUrl: courseResult.data.coverImageUrl ?? '',
      benefits: courseResult.data.benefits.join('\n'),
      bonus: courseResult.data.bonus.join('\n'),
      price: amountMinorToPriceMajor(courseResult.data.amountMinor),
      currency: courseResult.data.currency ?? 'ARS',
      accessMode: courseResult.data.accessMode,
    })
    if (studentsResult.ok) {
      setStudents(studentsResult.data.filter((s) => s.isActive))
    }
    if (!modulesResult.ok) {
      setError(modulesResult.message)
      setModules([])
      return
    }
    setModules(
      modulesResult.data
        .filter((m) => m.isActive)
        .sort((a, b) => a.position - b.position)
        .map((module) => ({
          module,
          lessons: [],
          expanded: false,
          loadingLessons: false,
        })),
    )
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!loading && !course && !error) {
    notFound()
  }

  async function saveCourse() {
    if (!course || saving) return
    setSaving(true)
    setError('')
    setSuccess('')

    const priceTrimmed = editForm.price.trim()
    let amountPatch: {
      amountMinor: string | null
      currency: FinanceCurrency | null
    }
    if (!priceTrimmed) {
      amountPatch = { amountMinor: null, currency: null }
    } else {
      const parsed = priceMajorToAmountMinor(priceTrimmed)
      if (parsed === null) {
        setSaving(false)
        setError('Ingresá un precio válido (ej. 15000 o 15000.50).')
        return
      }
      amountPatch = { amountMinor: parsed, currency: editForm.currency }
    }

    const lines = (raw: string) =>
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    const result = await updateOnlineCourseBrowser(course.id, {
      title: editForm.title.trim(),
      slug: editForm.slug.trim(),
      subtitle: editForm.subtitle.trim() || null,
      description: editForm.description.trim() || null,
      coverImageUrl: editForm.coverImageUrl.trim() || null,
      benefits: lines(editForm.benefits),
      bonus: lines(editForm.bonus),
      accessMode: editForm.accessMode,
      ...amountPatch,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setCourse(result.data)
    setSuccess('Curso guardado.')
  }

  async function grantAccess() {
    if (!course || !grantStudentId || saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    const result = await grantOnlineCourseAccessBrowser(course.id, {
      studentId: grantStudentId,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSuccess('Acceso concedido al estudiante.')
    setGrantStudentId('')
  }

  function clientPublishBlockers(): string[] {
    const blockers: string[] = []
    if (!editForm.title.trim()) {
      blockers.push('El curso necesita un título válido.')
    }
    if (!editForm.description.trim()) {
      blockers.push('El curso necesita una descripción válida.')
    }
    if (modules.length === 0) {
      blockers.push('El curso necesita al menos un módulo.')
    } else {
      const loadedLessons = modules.flatMap((block) => block.lessons)
      const anyLessonsLoaded = modules.some(
        (block) => block.expanded || block.lessons.length > 0,
      )
      if (
        anyLessonsLoaded &&
        !loadedLessons.some((lesson) => lesson.status === 'PUBLISHED')
      ) {
        blockers.push(
          'Agregá una lección publicada antes de publicar el curso.',
        )
      }
    }
    return blockers
  }

  async function runStatus(
    action: 'publish' | 'unpublish' | 'archive',
  ) {
    if (!course || saving) return
    setSaving(true)
    setError('')
    setPublishIssues([])
    setSuccess('')

    if (action === 'publish') {
      const localBlockers = clientPublishBlockers()
      if (localBlockers.length > 0) {
        setSaving(false)
        setPublishIssues(localBlockers)
        setError(
          localBlockers.length > 1
            ? 'No se puede publicar el curso todavía. Revisá los requisitos pendientes.'
            : (localBlockers[0] ??
              'No se puede publicar el curso todavía.'),
        )
        return
      }
    }

    const fn =
      action === 'publish'
        ? publishOnlineCourseBrowser
        : action === 'unpublish'
          ? unpublishOnlineCourseBrowser
          : archiveOnlineCourseBrowser
    const result = await fn(course.id)
    setSaving(false)
    if (!result.ok) {
      if (action === 'publish') {
        const lines = result.message
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        setPublishIssues(lines)
        setError(
          lines.length > 1
            ? 'No se puede publicar el curso. Revisá los requisitos pendientes.'
            : lines[0] || result.message,
        )
        return
      }
      setError(result.message)
      return
    }
    setCourse(result.data)
    setPublishIssues([])
    setSuccess(
      action === 'publish'
        ? 'Curso publicado.'
        : action === 'unpublish'
          ? 'Curso pasado a borrador.'
          : 'Curso archivado.',
    )
  }

  async function addModule() {
    if (!course || !newModuleTitle.trim() || saving) return
    setSaving(true)
    setError('')
    const result = await createOnlineCourseModuleBrowser(course.id, {
      title: newModuleTitle.trim(),
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setNewModuleTitle('')
    setModules((current) => [
      ...current,
      {
        module: result.data,
        lessons: [],
        expanded: true,
        loadingLessons: false,
      },
    ])
  }

  async function moveModule(index: number, direction: -1 | 1) {
    if (!course) return
    const next = index + direction
    if (next < 0 || next >= modules.length) return
    const ordered = [...modules]
    const [item] = ordered.splice(index, 1)
    if (!item) return
    ordered.splice(next, 0, item)
    const moduleIds = ordered.map((m) => m.module.id)
    setModules(ordered)
    const result = await reorderOnlineCourseModulesBrowser(course.id, moduleIds)
    if (!result.ok) {
      setError(result.message)
      void load()
    }
  }

  async function toggleModule(index: number) {
    if (!course) return
    const block = modules[index]
    if (!block) return
    const willExpand = !block.expanded
    setModules((current) =>
      current.map((m, i) =>
        i === index
          ? { ...m, expanded: willExpand, loadingLessons: willExpand }
          : m,
      ),
    )
    if (!willExpand) return
    const result = await listOnlineLessonsBrowser(course.id, block.module.id)
    setModules((current) =>
      current.map((m, i) => {
        if (i !== index) return m
        if (!result.ok) return { ...m, loadingLessons: false }
        return {
          ...m,
          loadingLessons: false,
          lessons: result.data
            .filter((l) => l.isActive)
            .sort((a, b) => a.position - b.position),
        }
      }),
    )
    if (!result.ok) setError(result.message)
  }

  function openNewLessonForm(moduleId: string) {
    setCreatingLessonModuleId(moduleId)
    setNewLessonForm(EMPTY_NEW_LESSON_FORM)
    setNewLessonError('')
    setError('')
  }

  function cancelNewLessonForm() {
    if (newLessonSaving) return
    setCreatingLessonModuleId(null)
    setNewLessonForm(EMPTY_NEW_LESSON_FORM)
    setNewLessonError('')
  }

  async function submitNewLesson(moduleIndex: number) {
    if (!course || newLessonSaving) return
    const block = modules[moduleIndex]
    if (!block || block.module.id !== creatingLessonModuleId) return

    const title = newLessonForm.title.trim()
    if (!title) {
      setNewLessonError('Ingresá el título de la lección.')
      return
    }

    const minutesRaw = newLessonForm.estimatedMinutes.trim()
    let estimatedMinutes: number | undefined
    if (minutesRaw) {
      const parsed = Number(minutesRaw)
      if (!Number.isInteger(parsed) || parsed < 1) {
        setNewLessonError('Ingresá una duración en minutos válida.')
        return
      }
      estimatedMinutes = parsed
    }

    setNewLessonSaving(true)
    setNewLessonError('')
    setError('')
    const result = await createOnlineLessonBrowser(course.id, block.module.id, {
      title,
      status: newLessonForm.status,
      isRequired: newLessonForm.isRequired,
      acceptsSubmission: newLessonForm.acceptsSubmission,
      ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
    })
    setNewLessonSaving(false)
    if (!result.ok) {
      setNewLessonError(result.message)
      return
    }
    setModules((current) =>
      current.map((m, i) =>
        i === moduleIndex
          ? { ...m, lessons: [...m.lessons, result.data], expanded: true }
          : m,
      ),
    )
    setCreatingLessonModuleId(null)
    setNewLessonForm(EMPTY_NEW_LESSON_FORM)
    setSuccess('Lección creada.')
  }

  async function moveLesson(
    moduleIndex: number,
    lessonIndex: number,
    direction: -1 | 1,
  ) {
    if (!course) return
    const block = modules[moduleIndex]
    if (!block) return
    const next = lessonIndex + direction
    if (next < 0 || next >= block.lessons.length) return
    const ordered = [...block.lessons]
    const [item] = ordered.splice(lessonIndex, 1)
    if (!item) return
    ordered.splice(next, 0, item)
    setModules((current) =>
      current.map((m, i) =>
        i === moduleIndex ? { ...m, lessons: ordered } : m,
      ),
    )
    const result = await reorderOnlineLessonsBrowser(
      course.id,
      block.module.id,
      ordered.map((l) => l.id),
    )
    if (!result.ok) {
      setError(result.message)
      void toggleModule(moduleIndex)
    }
  }

  async function patchLesson(
    moduleIndex: number,
    lesson: OnlineLesson,
    patch: {
      estimatedMinutes?: number | null
      isRequired?: boolean
      status?: OnlineLessonStatus
      acceptsSubmission?: boolean
      title?: string
    },
  ) {
    if (!course) return
    const block = modules[moduleIndex]
    if (!block) return
    const result = await updateOnlineLessonBrowser(
      course.id,
      block.module.id,
      lesson.id,
      patch,
    )
    if (!result.ok) {
      setError(result.message)
      return
    }
    setModules((current) =>
      current.map((m, i) =>
        i === moduleIndex
          ? {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id === lesson.id ? result.data : l,
              ),
            }
          : m,
      ),
    )
  }

  return (
    <DashboardShell title={course?.title ?? 'Curso online'}>
      <PageHeader
        eyebrow="Curso online"
        title={course?.title ?? 'Cargando…'}
        description="Editá datos, publicá y armá módulos y lecciones."
        action={
          <Link
            href="/dashboard/online-courses"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted"
          >
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        }
      />

      {loading ? <Skeleton className="mt-6 h-64 w-full" /> : null}
      {error ? (
        <div className="mt-6 space-y-2">
          <Alert>{error}</Alert>
          {publishIssues.length > 1 ? (
            <Alert>
              <p className="font-semibold">Requisitos pendientes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {publishIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <div className="mt-6">
          <Alert tone="success">{success}</Alert>
        </div>
      ) : null}

      {course ? (
        <div className="mt-6 space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={statusTone(course.status)}>
                {onlineCourseStatusLabels[course.status]}
              </Badge>
              <a
                href={`/cursos/${course.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
              >
                Vista pública <ExternalLink className="size-3.5" />
              </a>
              <p className="text-xs text-muted-foreground">
                Si está en borrador o archivado, no se muestra públicamente.
              </p>
            </div>
            <div className="mt-5 grid gap-4">
              <Field label="Título" htmlFor="edit-title">
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((c) => ({ ...c, title: e.target.value }))
                  }
                />
              </Field>
              <Field label="Slug" htmlFor="edit-slug">
                <Input
                  id="edit-slug"
                  value={editForm.slug}
                  onChange={(e) =>
                    setEditForm((c) => ({
                      ...c,
                      slug: e.target.value.toLowerCase(),
                    }))
                  }
                />
              </Field>
              <Field label="Subtítulo" htmlFor="edit-subtitle">
                <Input
                  id="edit-subtitle"
                  value={editForm.subtitle}
                  onChange={(e) =>
                    setEditForm((c) => ({ ...c, subtitle: e.target.value }))
                  }
                />
              </Field>
              <Field label="Descripción" htmlFor="edit-description">
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((c) => ({ ...c, description: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="URL de portada (https)"
                htmlFor="edit-cover"
                hint="Imagen pública HTTPS"
              >
                <Input
                  id="edit-cover"
                  value={editForm.coverImageUrl}
                  onChange={(e) =>
                    setEditForm((c) => ({
                      ...c,
                      coverImageUrl: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="Beneficios"
                htmlFor="edit-benefits"
                hint="Un beneficio por línea"
              >
                <Textarea
                  id="edit-benefits"
                  value={editForm.benefits}
                  onChange={(e) =>
                    setEditForm((c) => ({ ...c, benefits: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Bonus"
                htmlFor="edit-bonus"
                hint="Un ítem por línea"
              >
                <Textarea
                  id="edit-bonus"
                  value={editForm.bonus}
                  onChange={(e) =>
                    setEditForm((c) => ({ ...c, bonus: e.target.value }))
                  }
                />
              </Field>
              <Field label="Modo de acceso" htmlFor="edit-access">
                <Select
                  id="edit-access"
                  value={editForm.accessMode}
                  onChange={(e) =>
                    setEditForm((c) => ({
                      ...c,
                      accessMode: e.target.value as OnlineCourseAccessMode,
                    }))
                  }
                >
                  {ONLINE_COURSE_ACCESS_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {onlineCourseAccessModeLabels[mode]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <Field label="Precio" htmlFor="edit-price" hint="Vacío = gratis">
                  <Input
                    id="edit-price"
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm((c) => ({ ...c, price: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Moneda" htmlFor="edit-currency">
                  <Select
                    id="edit-currency"
                    value={editForm.currency}
                    onChange={(e) =>
                      setEditForm((c) => ({
                        ...c,
                        currency: e.target.value as FinanceCurrency,
                      }))
                    }
                  >
                    {FINANCE_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void saveCourse()} disabled={saving}>
                Guardá cambios
              </Button>
              {course.status !== 'PUBLISHED' ? (
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void runStatus('publish')}
                >
                  Publicar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => void runStatus('unpublish')}
                >
                  Despublicar
                </Button>
              )}
              {course.status !== 'ARCHIVED' ? (
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => void runStatus('archive')}
                >
                  Archivar
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold">Acceso de alumnos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Concedé acceso manual (cursos pagos o inscripción asistida). Los
              gratuitos también pueden autosuscribirse desde la ficha pública.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Field label="Estudiante" htmlFor="grant-student">
                  <Select
                    id="grant-student"
                    value={grantStudentId}
                    onChange={(e) => setGrantStudentId(e.target.value)}
                  >
                    <option value="">Seleccioná…</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.lastName}, {student.firstName}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                type="button"
                disabled={saving || !grantStudentId}
                onClick={() => void grantAccess()}
              >
                Conceder acceso
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Módulos</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Expandí un módulo para ver y editar lecciones.
                </p>
              </div>
              <div className="flex w-full max-w-md gap-2 sm:w-auto">
                <Input
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  placeholder="Nuevo módulo"
                />
                <Button
                  type="button"
                  disabled={saving || !newModuleTitle.trim()}
                  onClick={() => void addModule()}
                >
                  <Plus className="size-4" />
                  Agregar
                </Button>
              </div>
            </div>

            {modules.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                No hay módulos todavía. Agregá el primero.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {modules.map((block, moduleIndex) => (
                  <li
                    key={block.module.id}
                    className="rounded-xl border border-border bg-surface"
                  >
                    <div className="flex items-center gap-2 px-3 py-3">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-2 text-left font-medium"
                        onClick={() => void toggleModule(moduleIndex)}
                      >
                        {block.expanded ? (
                          <ChevronDown className="size-4 shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0" />
                        )}
                        <span>
                          {moduleIndex + 1}. {block.module.title}
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Subir módulo"
                        disabled={moduleIndex === 0}
                        onClick={() => void moveModule(moduleIndex, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Bajar módulo"
                        disabled={moduleIndex === modules.length - 1}
                        onClick={() => void moveModule(moduleIndex, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                    {block.expanded ? (
                      <div className="border-t border-border px-3 py-3">
                        {block.loadingLessons ? (
                          <Skeleton className="h-20 w-full" />
                        ) : (
                          <>
                            {creatingLessonModuleId === block.module.id ? (
                              <NewLessonForm
                                formId={`new-lesson-${block.module.id}`}
                                value={newLessonForm}
                                error={newLessonError}
                                saving={newLessonSaving}
                                onChange={setNewLessonForm}
                                onCancel={cancelNewLessonForm}
                                onSubmit={() =>
                                  void submitNewLesson(moduleIndex)
                                }
                              />
                            ) : (
                              <div className="mb-3 flex justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openNewLessonForm(block.module.id)
                                  }
                                >
                                  <Plus className="size-3.5" />
                                  Nueva lección
                                </Button>
                              </div>
                            )}
                            {block.lessons.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No hay lecciones en este módulo.
                              </p>
                            ) : (
                              <ul className="space-y-4">
                                {block.lessons.map((lesson, lessonIndex) => (
                                  <li
                                    key={lesson.id}
                                    className="rounded-xl border border-border p-3"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1 space-y-3">
                                        <Field
                                          label="Título"
                                          htmlFor={`lesson-title-${lesson.id}`}
                                        >
                                          <Input
                                            id={`lesson-title-${lesson.id}`}
                                            key={`title-${lesson.id}-${lesson.updatedAt}`}
                                            className="font-medium"
                                            defaultValue={lesson.title}
                                            onBlur={(e) => {
                                              const title = e.target.value.trim()
                                              if (!title) {
                                                e.target.value = lesson.title
                                                setError(
                                                  'El título de la lección no puede quedar vacío.',
                                                )
                                                return
                                              }
                                              if (title !== lesson.title) {
                                                void patchLesson(
                                                  moduleIndex,
                                                  lesson,
                                                  { title },
                                                )
                                              }
                                            }}
                                          />
                                        </Field>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                          <Field
                                            label="Duración (minutos)"
                                            htmlFor={`lesson-min-${lesson.id}`}
                                          >
                                            <Input
                                              id={`lesson-min-${lesson.id}`}
                                              key={`min-${lesson.id}-${lesson.updatedAt}`}
                                              className="w-28"
                                              type="number"
                                              min={1}
                                              defaultValue={
                                                lesson.estimatedMinutes ?? ''
                                              }
                                              onBlur={(e) => {
                                                const raw = e.target.value.trim()
                                                const value = raw
                                                  ? Number(raw)
                                                  : null
                                                if (
                                                  value !==
                                                  lesson.estimatedMinutes
                                                ) {
                                                  void patchLesson(
                                                    moduleIndex,
                                                    lesson,
                                                    {
                                                      estimatedMinutes:
                                                        value && value > 0
                                                          ? value
                                                          : null,
                                                    },
                                                  )
                                                }
                                              }}
                                            />
                                          </Field>
                                          <label className="flex items-center gap-2 font-medium">
                                            <input
                                              type="checkbox"
                                              checked={lesson.isRequired}
                                              onChange={(e) =>
                                                void patchLesson(
                                                  moduleIndex,
                                                  lesson,
                                                  {
                                                    isRequired:
                                                      e.target.checked,
                                                  },
                                                )
                                              }
                                            />
                                            Lección obligatoria
                                          </label>
                                          <label className="flex items-center gap-2 font-medium">
                                            <input
                                              type="checkbox"
                                              checked={
                                                lesson.acceptsSubmission
                                              }
                                              onChange={(e) =>
                                                void patchLesson(
                                                  moduleIndex,
                                                  lesson,
                                                  {
                                                    acceptsSubmission:
                                                      e.target.checked,
                                                  },
                                                )
                                              }
                                            />
                                            Acepta entregas
                                          </label>
                                          <Field
                                            label="Estado"
                                            htmlFor={`lesson-status-${lesson.id}`}
                                          >
                                            <Select
                                              id={`lesson-status-${lesson.id}`}
                                              className="w-auto"
                                              value={lesson.status}
                                              onChange={(e) =>
                                                void patchLesson(
                                                  moduleIndex,
                                                  lesson,
                                                  {
                                                    status: e.target
                                                      .value as OnlineLessonStatus,
                                                  },
                                                )
                                              }
                                            >
                                              {ONLINE_LESSON_STATUSES.map(
                                                (s) => (
                                                  <option key={s} value={s}>
                                                    {s === 'PUBLISHED'
                                                      ? 'Publicada'
                                                      : 'Borrador'}
                                                  </option>
                                                ),
                                              )}
                                            </Select>
                                          </Field>
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          disabled={lessonIndex === 0}
                                          onClick={() =>
                                            void moveLesson(
                                              moduleIndex,
                                              lessonIndex,
                                              -1,
                                            )
                                          }
                                          aria-label="Subir lección"
                                        >
                                          <ArrowUp className="size-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          disabled={
                                            lessonIndex ===
                                            block.lessons.length - 1
                                          }
                                          onClick={() =>
                                            void moveLesson(
                                              moduleIndex,
                                              lessonIndex,
                                              1,
                                            )
                                          }
                                          aria-label="Bajar lección"
                                        >
                                          <ArrowDown className="size-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    <LessonAssets
                                      lessonId={lesson.id}
                                      onError={setError}
                                    />
                                    <LessonQuizEditor
                                      lessonId={lesson.id}
                                      onError={setError}
                                      onSuccess={setSuccess}
                                    />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </DashboardShell>
  )
}
