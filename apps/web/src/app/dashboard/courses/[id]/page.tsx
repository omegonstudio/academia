'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit3 } from 'lucide-react'
import type { Course, CourseServiceType, CourseType } from '@academia/shared'
import { COURSE_SERVICE_TYPES, COURSE_TYPES } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { MaterialsSection } from '@/components/materials-section'
import { useSessionUser } from '@/components/session-provider'
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
  courseServiceTypeLabels,
  courseTypeLabels,
  deactivateCourseBrowser,
  getCourseBrowser,
  priceMajorToAmountMinor,
  updateCourseBrowser,
} from '@/lib/api-browser'
import { canMutateMaterialsUi } from '@/lib/materials'

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const user = useSessionUser()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    courseType: 'REGULAR' as CourseType,
    serviceType: 'ONE_TO_ONE_60' as CourseServiceType,
    price: '',
    currency: 'ARS' as 'ARS' | 'USD',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await getCourseBrowser(id)
    setLoading(false)
    if (!result.ok) {
      if (result.status === 404) {
        setCourse(null)
        return
      }
      setError(result.message)
      return
    }
    setCourse(result.data)
    setEditForm({
      name: result.data.name,
      description: result.data.description ?? '',
      courseType: result.data.courseType,
      serviceType: result.data.serviceType,
      price: amountMinorToPriceMajor(result.data.amountMinor),
      currency: result.data.currency ?? 'ARS',
    })
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!loading && !course && !error) {
    notFound()
  }

  async function saveEdits() {
    if (!course || saving) return
    setSaving(true)
    setError('')

    const priceTrimmed = editForm.price.trim()
    let amountPatch: {
      amountMinor: string | null
      currency: 'ARS' | 'USD' | null
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

    const result = await updateCourseBrowser(course.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      courseType: editForm.courseType,
      serviceType: editForm.serviceType,
      ...amountPatch,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setCourse(result.data)
    setEditing(false)
  }

  async function confirmSoftDelete() {
    if (!course || saving) return
    setSaving(true)
    setError('')
    const result = await deactivateCourseBrowser(course.id)
    setSaving(false)
    setConfirmDeactivate(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setCourse(result.data)
  }

  const priceLabel =
    course?.amountMinor && course.currency
      ? `${amountMinorToPriceMajor(course.amountMinor)} ${course.currency}`
      : 'Sin precio'

  return (
    <DashboardShell title="Detalle de curso">
      <Link
        href="/dashboard/courses"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a cursos
      </Link>
      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : course ? (
        <>
          <PageHeader
            eyebrow="Curso"
            title={course.name}
            description={course.description || 'Sin descripción'}
            action={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditing(!editing)}
                  disabled={saving}
                >
                  <Edit3 />
                  {editing ? 'Cancelar' : 'Editar'}
                </Button>
                {course.isActive ? (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmDeactivate(true)}
                    disabled={saving}
                  >
                    Desactivar
                  </Button>
                ) : null}
              </div>
            }
          />
          {error ? (
            <div className="mb-5">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="font-semibold">Información del curso</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Info label="Nombre" value={course.name} />
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <div className="mt-2">
                    <Badge tone={course.isActive ? 'success' : 'neutral'}>
                      {course.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <Info
                  label="Descripción"
                  value={course.description || 'Sin descripción'}
                />
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="font-semibold">Configuración académica</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <div className="mt-2">
                    <Badge tone="info">
                      {courseTypeLabels[course.courseType]}
                    </Badge>
                  </div>
                </div>
                <Info
                  label="Modalidad"
                  value={courseServiceTypeLabels[course.serviceType]}
                />
                <Info
                  label="Duración"
                  value={`${course.durationMinutes} min`}
                />
                <Info label="Precio" value={priceLabel} />
              </div>
            </Card>
          </div>
          {editing ? (
            <Card className="mt-5 p-6">
              <h2 className="font-semibold">Editar curso</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="edit-name">
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Tipo de curso" htmlFor="edit-course-type">
                  <Select
                    id="edit-course-type"
                    value={editForm.courseType}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        courseType: event.target.value as CourseType,
                      }))
                    }
                  >
                    {COURSE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {courseTypeLabels[type]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Descripción" htmlFor="edit-description">
                    <Textarea
                      id="edit-description"
                      value={editForm.description}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Modalidad" htmlFor="edit-service-type">
                  <Select
                    id="edit-service-type"
                    value={editForm.serviceType}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        serviceType: event.target.value as CourseServiceType,
                      }))
                    }
                  >
                    {COURSE_SERVICE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {courseServiceTypeLabels[type]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Precio"
                  htmlFor="edit-price"
                  hint="Vacío = sin precio"
                >
                  <Input
                    id="edit-price"
                    inputMode="decimal"
                    value={editForm.price}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Moneda" htmlFor="edit-currency">
                  <Select
                    id="edit-currency"
                    value={editForm.currency}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        currency: event.target.value as 'ARS' | 'USD',
                      }))
                    }
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </Select>
                </Field>
              </div>
              <Button
                className="mt-5"
                onClick={() => void saveEdits()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </Card>
          ) : null}
          <MaterialsSection
            courseId={course.id}
            heading="Materiales del curso"
            canWrite={canMutateMaterialsUi(user.role)}
            contextActive={course.isActive}
          />
          {confirmDeactivate ? (
            <ConfirmDialog
              title="¿Querés desactivar este curso?"
              description="El curso dejará de estar activo en la academia."
              confirmLabel="Desactivar"
              onConfirm={() => {
                void confirmSoftDelete()
              }}
              onClose={() => setConfirmDeactivate(false)}
            />
          ) : null}
        </>
      ) : (
        <div>
          <Alert>{error || 'No pudimos cargar el curso.'}</Alert>
          <Button className="mt-3" variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      )}
    </DashboardShell>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}
