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
} from '@academia/shared'
import {
  FINANCE_CURRENCIES,
  ONLINE_COURSE_ACCESS_MODES,
  ONLINE_LESSON_STATUSES,
} from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import {
  Alert,
  Badge,
  Button,
  Card,
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

function statusTone(
  status: OnlineCourse['status'],
): 'neutral' | 'success' | 'warning' {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
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
  const [title, setTitle] = useState('Cuestionario')
  const [passScore, setPassScore] = useState('70')
  const [prompt, setPrompt] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [correct, setCorrect] = useState<'A' | 'B'>('A')
  const [saving, setSaving] = useState(false)
  const [existingTitle, setExistingTitle] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await getOnlineQuizAdminBrowser(lessonId)
      if (cancelled || !result.ok || !result.data) return
      setExistingTitle(result.data.title)
      setTitle(result.data.title)
      setPassScore(
        result.data.passScorePercent !== null
          ? String(result.data.passScorePercent)
          : '',
      )
    })()
    return () => {
      cancelled = true
    }
  }, [lessonId])

  async function saveQuiz() {
    if (!prompt.trim() || !optionA.trim() || !optionB.trim() || saving) return
    setSaving(true)
    const pass =
      passScore.trim() === '' ? null : Number.parseInt(passScore.trim(), 10)
    const result = await upsertOnlineQuizBrowser(lessonId, {
      title: title.trim() || 'Cuestionario',
      passScorePercent:
        pass !== null && Number.isFinite(pass) ? pass : null,
      questions: [
        {
          prompt: prompt.trim(),
          type: 'SINGLE_CHOICE',
          points: 1,
          options: [
            { label: optionA.trim(), isCorrect: correct === 'A' },
            { label: optionB.trim(), isCorrect: correct === 'B' },
          ],
        },
      ],
    })
    setSaving(false)
    if (!result.ok) {
      onError(result.message)
      return
    }
    setExistingTitle(result.data.title)
    onSuccess('Cuestionario guardado.')
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-border p-3">
      <p className="text-sm font-medium">
        Cuestionario
        {existingTitle ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({existingTitle})
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Editor simple: una pregunta de opción única. Guardar reemplaza el
        cuestionario completo de la lección.
      </p>
      <div className="mt-3 grid gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del cuestionario"
        />
        <Input
          value={passScore}
          onChange={(e) => setPassScore(e.target.value)}
          placeholder="Nota mínima % (opcional)"
        />
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Pregunta"
        />
        <Input
          value={optionA}
          onChange={(e) => setOptionA(e.target.value)}
          placeholder="Opción A"
        />
        <Input
          value={optionB}
          onChange={(e) => setOptionB(e.target.value)}
          placeholder="Opción B"
        />
        <Select
          value={correct}
          onChange={(e) => setCorrect(e.target.value as 'A' | 'B')}
          aria-label="Respuesta correcta"
        >
          <option value="A">Correcta: A</option>
          <option value="B">Correcta: B</option>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={saving || !prompt.trim() || !optionA.trim() || !optionB.trim()}
          onClick={() => void saveQuiz()}
        >
          Guardar cuestionario
        </Button>
      </div>
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
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
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

  async function runStatus(
    action: 'publish' | 'unpublish' | 'archive',
  ) {
    if (!course || saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    const fn =
      action === 'publish'
        ? publishOnlineCourseBrowser
        : action === 'unpublish'
          ? unpublishOnlineCourseBrowser
          : archiveOnlineCourseBrowser
    const result = await fn(course.id)
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setCourse(result.data)
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

  async function addLesson(moduleIndex: number) {
    if (!course) return
    const block = modules[moduleIndex]
    if (!block) return
    const title = window.prompt('Título de la lección')
    if (!title?.trim()) return
    const result = await createOnlineLessonBrowser(
      course.id,
      block.module.id,
      { title: title.trim(), status: 'DRAFT' },
    )
    if (!result.ok) {
      setError(result.message)
      return
    }
    setModules((current) =>
      current.map((m, i) =>
        i === moduleIndex
          ? { ...m, lessons: [...m.lessons, result.data], expanded: true }
          : m,
      ),
    )
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
        <div className="mt-6">
          <Alert>{error}</Alert>
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
                            <div className="mb-3 flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void addLesson(moduleIndex)}
                              >
                                <Plus className="size-3.5" />
                                Nueva lección
                              </Button>
                            </div>
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
                                      <div className="min-w-0 flex-1">
                                        <Input
                                          className="font-medium"
                                          defaultValue={lesson.title}
                                          onBlur={(e) => {
                                            const title = e.target.value.trim()
                                            if (
                                              title &&
                                              title !== lesson.title
                                            ) {
                                              void patchLesson(
                                                moduleIndex,
                                                lesson,
                                                { title },
                                              )
                                            }
                                          }}
                                          aria-label="Título de lección"
                                        />
                                        <div className="mt-2 flex flex-wrap gap-3 text-sm">
                                          <label className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground">
                                              Min
                                            </span>
                                            <Input
                                              className="w-20"
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
                                          </label>
                                          <label className="flex items-center gap-1.5">
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
                                            Obligatoria
                                          </label>
                                          <label className="flex items-center gap-1.5">
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
                                            Acepta entrega
                                          </label>
                                          <Select
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
                                            aria-label="Estado de lección"
                                          >
                                            {ONLINE_LESSON_STATUSES.map((s) => (
                                              <option key={s} value={s}>
                                                {s === 'PUBLISHED'
                                                  ? 'Publicada'
                                                  : 'Borrador'}
                                              </option>
                                            ))}
                                          </Select>
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
