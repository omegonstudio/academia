'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Plus, Search } from 'lucide-react'
import type {
  FinanceCurrency,
  OnlineCourse,
  OnlineCourseAccessMode,
} from '@academia/shared'
import { FINANCE_CURRENCIES, ONLINE_COURSE_ACCESS_MODES } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives'
import {
  createOnlineCourseBrowser,
  listOnlineCoursesBrowser,
  onlineCourseAccessModeLabels,
  onlineCourseStatusLabels,
  priceMajorToAmountMinor,
  slugifyOnlineCourseTitle,
} from '@/lib/api-browser'

function statusTone(
  status: OnlineCourse['status'],
): 'neutral' | 'success' | 'warning' {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

function CreateOnlineCourseForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (course: OnlineCourse) => void
}) {
  const [form, setForm] = useState({
    title: '',
    slug: '',
    slugTouched: false,
    subtitle: '',
    description: '',
    price: '',
    currency: 'ARS' as FinanceCurrency,
    accessMode: 'OPEN' as OnlineCourseAccessMode,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setError('')
    if (!form.title.trim()) {
      setError('Ingresá el título del curso.')
      return
    }
    const slug = form.slug.trim() || slugifyOnlineCourseTitle(form.title)
    if (!slug) {
      setError('Ingresá un slug válido (kebab-case).')
      return
    }

    const priceTrimmed = form.price.trim()
    let amountMinor: string | undefined
    if (priceTrimmed) {
      const parsed = priceMajorToAmountMinor(priceTrimmed)
      if (parsed === null) {
        setError('Ingresá un precio válido (ej. 15000 o 15000.50).')
        return
      }
      amountMinor = parsed
    }

    setSaving(true)
    const result = await createOnlineCourseBrowser({
      title: form.title.trim(),
      slug,
      subtitle: form.subtitle.trim() || undefined,
      description: form.description.trim() || undefined,
      accessMode: form.accessMode,
      ...(amountMinor !== undefined
        ? { amountMinor, currency: form.currency }
        : {}),
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onCreated(result.data)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 isolate flex items-center justify-center bg-foreground/50 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="online-course-form-title"
    >
      <form
        onSubmit={submit}
        className="max-h-[min(860px,calc(100vh-2.5rem))] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="online-course-form-title" className="text-xl font-semibold">
              Nuevo curso online
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Curso asíncrono con módulos y lecciones.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-muted-foreground"
            aria-label="Cerrar"
            disabled={saving}
          >
            ×
          </button>
        </div>
        {error ? (
          <div className="mt-5">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-4">
          <Field label="Título" htmlFor="oc-title">
            <Input
              id="oc-title"
              required
              value={form.title}
              onChange={(event) => {
                const title = event.target.value
                setForm((current) => ({
                  ...current,
                  title,
                  slug: current.slugTouched
                    ? current.slug
                    : slugifyOnlineCourseTitle(title),
                }))
              }}
              placeholder="Ej. Español desde cero"
            />
          </Field>
          <Field
            label="Slug"
            htmlFor="oc-slug"
            hint="URL pública: /cursos/tu-slug"
          >
            <Input
              id="oc-slug"
              required
              value={form.slug}
              onChange={(event) =>
                update('slug', event.target.value.toLowerCase())
              }
              onBlur={() => update('slugTouched', true)}
              placeholder="espanol-desde-cero"
            />
          </Field>
          <Field label="Subtítulo" htmlFor="oc-subtitle">
            <Input
              id="oc-subtitle"
              value={form.subtitle}
              onChange={(event) => update('subtitle', event.target.value)}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Descripción" htmlFor="oc-description">
            <Textarea
              id="oc-description"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Contá de qué trata el curso."
            />
          </Field>
          <Field label="Modo de acceso" htmlFor="oc-access">
            <Select
              id="oc-access"
              value={form.accessMode}
              onChange={(event) =>
                update('accessMode', event.target.value as OnlineCourseAccessMode)
              }
            >
              {ONLINE_COURSE_ACCESS_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {onlineCourseAccessModeLabels[mode]}
                  {mode === 'LINEAR'
                    ? ' (hay que completar lecciones previas)'
                    : ' (se puede saltar)'}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field
              label="Precio"
              htmlFor="oc-price"
              hint="Opcional. Vacío = gratis."
            >
              <Input
                id="oc-price"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => update('price', event.target.value)}
                placeholder="Gratis"
              />
            </Field>
            <Field label="Moneda" htmlFor="oc-currency">
              <Select
                id="oc-currency"
                value={form.currency}
                onChange={(event) =>
                  update('currency', event.target.value as FinanceCurrency)
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
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button disabled={saving}>
            {saving ? 'Creando…' : 'Crear curso'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function OnlineCoursesPage() {
  const [courses, setCourses] = useState<OnlineCourse[]>([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await listOnlineCoursesBrowser()
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      setCourses([])
      return
    }
    setCourses(result.data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = courses.filter((course) =>
    `${course.title} ${course.subtitle ?? ''} ${course.slug}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <DashboardShell title="Cursos online">
      <PageHeader
        eyebrow="Academia"
        title="Cursos online"
        description="Cursos asíncronos con módulos, lecciones y progreso."
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus />
            Nuevo curso
          </Button>
        }
      />
      <Card className="mb-5 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            className="pl-10"
            aria-label="Buscar cursos online"
            placeholder="Buscar por título o slug"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Card>
      {success ? (
        <div className="mb-5">
          <Alert tone="success">Curso online creado correctamente.</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mb-5">
          <Alert>{error}</Alert>
          <Button className="mt-3" variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : null}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Todavía no hay cursos online."
          description="Creá el primero para armar módulos y lecciones."
          action={
            <Button onClick={() => setShowForm(true)}>
              <BookOpen />
              Crear curso online
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <Link
              href={`/dashboard/online-courses/${course.id}`}
              key={course.id}
              className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen />
                </span>
                <Badge tone={statusTone(course.status)}>
                  {onlineCourseStatusLabels[course.status]}
                </Badge>
              </div>
              <h3 className="mt-5 text-lg font-semibold group-hover:text-primary">
                {course.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {course.subtitle || course.description || 'Sin descripción'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                <span>
                  {course.moduleCount ?? 0} módulos · {course.lessonCount ?? 0}{' '}
                  lecciones
                </span>
                <span className="font-mono text-xs">{course.slug}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {showForm ? (
        <CreateOnlineCourseForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setSuccess(true)
            void load()
          }}
        />
      ) : null}
    </DashboardShell>
  )
}
