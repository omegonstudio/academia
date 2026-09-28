'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit3 } from 'lucide-react'
import type { Student, StudentLevel } from '@academia/shared'
import { STUDENT_LEVELS } from '@academia/shared'
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
  deactivateStudentBrowser,
  getStudentBrowser,
  getStudentTeacherBrowser,
  getTeacherBrowser,
  personFullName,
  updateStudentBrowser,
} from '@/lib/api-browser'

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [student, setStudent] = useState<Student | null>(null)
  const [teacherLabel, setTeacherLabel] = useState('Sin asignar')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    level: 'A1' as StudentLevel,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await getStudentBrowser(id)
    if (!result.ok) {
      setLoading(false)
      if (result.status === 404) {
        setStudent(null)
        return
      }
      setError(result.message)
      return
    }
    setStudent(result.data)
    setEditForm({
      firstName: result.data.firstName,
      lastName: result.data.lastName,
      level: result.data.level,
    })

    const assignment = await getStudentTeacherBrowser(id)
    if (assignment.ok && assignment.data) {
      const teacherRes = await getTeacherBrowser(assignment.data.teacherId)
      if (teacherRes.ok) {
        setTeacherLabel(personFullName(teacherRes.data))
      } else {
        setTeacherLabel(assignment.data.teacherId)
      }
    } else {
      setTeacherLabel('Sin asignar')
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!loading && !student && !error) {
    notFound()
  }

  async function saveEdits() {
    if (!student || saving) return
    setSaving(true)
    setError('')
    const result = await updateStudentBrowser(student.id, {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      level: editForm.level,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setStudent(result.data)
    setEditing(false)
  }

  async function confirmSoftDelete() {
    if (!student || saving) return
    setSaving(true)
    setError('')
    const result = await deactivateStudentBrowser(student.id)
    setSaving(false)
    setConfirmDeactivate(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setStudent(result.data)
  }

  return (
    <DashboardShell title="Detalle de estudiante">
      <Link
        href="/dashboard/students"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a estudiantes
      </Link>
      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : student ? (
        <>
          <PageHeader
            eyebrow="Perfil"
            title={personFullName(student)}
            description={student.email}
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
                {student.isActive ? (
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
                <Info label="Nombre" value={student.firstName} />
                <Info label="Apellido" value={student.lastName} />
                <Info label="Email" value={student.email} />
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="font-semibold">Información académica</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Nivel</p>
                  <div className="mt-2">
                    <Badge tone="info">{student.level}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <div className="mt-2">
                    <Badge tone={student.isActive ? 'success' : 'neutral'}>
                      {student.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <Info label="Profesor asignado" value={teacherLabel} />
              </div>
            </Card>
          </div>
          {editing ? (
            <Card className="mt-5 p-6">
              <h2 className="font-semibold">Editar estudiante</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="edit-first">
                  <Input
                    id="edit-first"
                    value={editForm.firstName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Apellido" htmlFor="edit-last">
                  <Input
                    id="edit-last"
                    value={editForm.lastName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Email" htmlFor="edit-email">
                  <Input
                    id="edit-email"
                    value={student.email}
                    type="email"
                    disabled
                    aria-describedby="email-readonly-hint"
                  />
                  <p
                    id="email-readonly-hint"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    El email no se edita desde este formulario.
                  </p>
                </Field>
                <Field label="Nivel" htmlFor="edit-level">
                  <Select
                    id="edit-level"
                    value={editForm.level}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        level: event.target.value as StudentLevel,
                      }))
                    }
                  >
                    {STUDENT_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
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
              title="¿Querés desactivar este estudiante?"
              description="El estudiante dejará de estar activo en la academia."
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
          <Alert>{error || 'No pudimos cargar el estudiante.'}</Alert>
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
