'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit3 } from 'lucide-react'
import type {
  Teacher,
  TeacherAvailability,
  TeacherLevel,
} from '@academia/shared'
import { TEACHER_AVAILABILITIES, TEACHER_LEVELS } from '@academia/shared'
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
} from '@/components/ui/primitives'
import {
  deactivateTeacherBrowser,
  getTeacherBrowser,
  personFullName,
  teacherAvailabilityLabels,
  updateTeacherBrowser,
} from '@/lib/api-browser'

function availabilityTone(
  availability: TeacherAvailability,
): 'success' | 'warning' | 'neutral' {
  if (availability === 'AVAILABLE') return 'success'
  if (availability === 'LIMITED') return 'warning'
  return 'neutral'
}

export default function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    level: 'A1' as TeacherLevel,
    availability: 'AVAILABLE' as TeacherAvailability,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await getTeacherBrowser(id)
    setLoading(false)
    if (!result.ok) {
      if (result.status === 404) {
        setTeacher(null)
        return
      }
      setError(result.message)
      return
    }
    setTeacher(result.data)
    setEditForm({
      firstName: result.data.firstName,
      lastName: result.data.lastName,
      level: result.data.level,
      availability: result.data.availability,
    })
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!loading && !teacher && !error) {
    notFound()
  }

  async function saveEdits() {
    if (!teacher || saving) return
    setSaving(true)
    setError('')
    const result = await updateTeacherBrowser(teacher.id, {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      level: editForm.level,
      availability: editForm.availability,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setTeacher(result.data)
    setEditing(false)
  }

  async function confirmSoftDelete() {
    if (!teacher || saving) return
    setSaving(true)
    setError('')
    const result = await deactivateTeacherBrowser(teacher.id)
    setSaving(false)
    setConfirmDeactivate(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setTeacher(result.data)
  }

  return (
    <DashboardShell title="Detalle de profesor">
      <Link
        href="/dashboard/teachers"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a profesores
      </Link>
      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : teacher ? (
        <>
          <PageHeader
            eyebrow="Perfil docente"
            title={personFullName(teacher)}
            description={teacher.email}
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
                {teacher.isActive ? (
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
              <h2 className="font-semibold">Información personal</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Info label="Nombre" value={teacher.firstName} />
                <Info label="Apellido" value={teacher.lastName} />
                <Info label="Email" value={teacher.email} />
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <div className="mt-2">
                    <Badge tone={teacher.isActive ? 'success' : 'neutral'}>
                      {teacher.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="font-semibold">Información académica</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Nivel</p>
                  <div className="mt-2">
                    <Badge tone="info">{teacher.level}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disponibilidad</p>
                  <div className="mt-2">
                    <Badge tone={availabilityTone(teacher.availability)}>
                      {teacherAvailabilityLabels[teacher.availability]}
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                La disponibilidad se mantiene separada del estado activo del
                perfil.
              </p>
            </Card>
          </div>
          {editing ? (
            <Card className="mt-5 p-6">
              <h2 className="font-semibold">Editar profesor</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="teacher-edit-first">
                  <Input
                    id="teacher-edit-first"
                    value={editForm.firstName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Apellido" htmlFor="teacher-edit-last">
                  <Input
                    id="teacher-edit-last"
                    value={editForm.lastName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Email" htmlFor="teacher-edit-email">
                  <Input
                    id="teacher-edit-email"
                    value={teacher.email}
                    type="email"
                    disabled
                    aria-describedby="teacher-email-readonly-hint"
                  />
                  <p
                    id="teacher-email-readonly-hint"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    El email no se edita desde este formulario.
                  </p>
                </Field>
                <Field label="Nivel" htmlFor="teacher-edit-level">
                  <Select
                    id="teacher-edit-level"
                    value={editForm.level}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        level: event.target.value as TeacherLevel,
                      }))
                    }
                  >
                    {TEACHER_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Disponibilidad"
                  htmlFor="teacher-edit-availability"
                >
                  <Select
                    id="teacher-edit-availability"
                    value={editForm.availability}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        availability: event.target
                          .value as TeacherAvailability,
                      }))
                    }
                  >
                    {TEACHER_AVAILABILITIES.map((availability) => (
                      <option key={availability} value={availability}>
                        {teacherAvailabilityLabels[availability]}
                      </option>
                    ))}
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
          {confirmDeactivate ? (
            <ConfirmDialog
              title="¿Querés desactivar este profesor?"
              description="El profesor dejará de estar activo en la academia."
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
          <Alert>{error || 'No pudimos cargar el profesor.'}</Alert>
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
