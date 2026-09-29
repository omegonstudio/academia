'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Plus, Search } from 'lucide-react'
import type { Course, CourseServiceType, CourseType } from '@academia/shared'
import { COURSE_SERVICE_TYPES, COURSE_TYPES } from '@academia/shared'
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
  courseServiceTypeLabels,
  courseTypeLabels,
  createCourseBrowser,
  listCoursesBrowser,
  priceMajorToAmountMinor,
} from '@/lib/api-browser'

function CourseForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (course: Course) => void
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    courseType: '' as '' | CourseType,
    serviceType: '' as '' | CourseServiceType,
    price: '',
    currency: 'ARS' as 'ARS' | 'USD',
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
    if (!form.name.trim()) {
      setError('Ingresá el nombre del curso.')
      return
    }
    if (!form.courseType) {
      setError('Seleccioná el tipo de curso.')
      return
    }
    if (!form.serviceType) {
      setError('Seleccioná la modalidad.')
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
    const result = await createCourseBrowser({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      courseType: form.courseType,
      serviceType: form.serviceType,
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
      aria-labelledby="course-form-title"
    >
      <form
        onSubmit={submit}
        className="max-h-[min(860px,calc(100vh-2.5rem))] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="course-form-title" className="text-xl font-semibold">
              Nuevo curso
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Completá la información básica del curso.
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
          <Field label="Nombre" htmlFor="course-name">
            <Input
              id="course-name"
              required
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Ej. Español Conversación"
            />
          </Field>
          <Field label="Descripción" htmlFor="course-description">
            <Textarea
              id="course-description"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Contá brevemente de qué trata el curso."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de curso" htmlFor="course-type">
              <Select
                id="course-type"
                required
                value={form.courseType}
                onChange={(event) =>
                  update('courseType', event.target.value as CourseType | '')
                }
              >
                <option value="">Seleccioná una opción</option>
                {COURSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {courseTypeLabels[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Modalidad" htmlFor="course-service">
              <Select
                id="course-service"
                required
                value={form.serviceType}
                onChange={(event) =>
                  update(
                    'serviceType',
                    event.target.value as CourseServiceType | '',
                  )
                }
              >
                <option value="">Seleccioná una opción</option>
                {COURSE_SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {courseServiceTypeLabels[type]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {form.serviceType ? (
            <div className="rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-primary">
              Duración:{' '}
              <strong>
                {
                  { ONE_TO_ONE_60: '60 min', ONE_TO_ONE_90: '90 min', GROUP_120: '120 min' }[
                    form.serviceType
                  ]
                }
              </strong>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field
              label="Precio"
              htmlFor="course-price"
              hint="Opcional. Unidades mayores (ej. 15000)."
            >
              <Input
                id="course-price"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => update('price', event.target.value)}
                placeholder="Sin cargo"
              />
            </Field>
            <Field label="Moneda" htmlFor="course-currency">
              <Select
                id="course-currency"
                value={form.currency}
                onChange={(event) =>
                  update('currency', event.target.value as 'ARS' | 'USD')
                }
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
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
            {saving ? 'Creando...' : 'Crear curso'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await listCoursesBrowser()
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
    `${course.name} ${course.description ?? ''} ${courseTypeLabels[course.courseType]} ${courseServiceTypeLabels[course.serviceType]}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <DashboardShell title="Cursos">
      <PageHeader
        eyebrow="Academia"
        title="Cursos"
        description="Organizá la propuesta académica de la academia."
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
            aria-label="Buscar cursos"
            placeholder="Buscar por nombre, tipo o modalidad"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Card>
      {success ? (
        <div className="mb-5">
          <Alert tone="success">Curso creado correctamente.</Alert>
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
          title="Todavía no hay cursos registrados."
          description="Podés crear el primer curso para organizar la oferta académica."
          action={
            <Button onClick={() => setShowForm(true)}>
              <BookOpen />
              Crear curso
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <Link
              href={`/dashboard/courses/${course.id}`}
              key={course.id}
              className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen />
                </span>
                <Badge tone={course.isActive ? 'success' : 'neutral'}>
                  {course.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <h3 className="mt-5 text-lg font-semibold group-hover:text-primary">
                {course.name}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {course.description || 'Sin descripción'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
                <Badge tone="info">{courseTypeLabels[course.courseType]}</Badge>
                <span className="text-muted-foreground">
                  {courseServiceTypeLabels[course.serviceType]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {showForm ? (
        <CourseForm
          onClose={() => setShowForm(false)}
          onCreated={(course) => {
            setCourses((current) => [course, ...current])
            setSuccess(true)
          }}
        />
      ) : null}
    </DashboardShell>
  )
}
