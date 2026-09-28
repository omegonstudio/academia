'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Eye, UserPlus } from 'lucide-react'
import type { Teacher, TeacherAvailability, TeacherLevel } from '@academia/shared'
import { TEACHER_AVAILABILITIES, TEACHER_LEVELS } from '@academia/shared'
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
} from '@/components/ui/primitives'
import {
  createTeacherBrowser,
  listTeachersBrowser,
  personFullName,
  teacherAvailabilityLabels,
} from '@/lib/api-browser'

function availabilityTone(
  availability: TeacherAvailability,
): 'success' | 'warning' | 'neutral' {
  if (availability === 'AVAILABLE') return 'success'
  if (availability === 'LIMITED') return 'warning'
  return 'neutral'
}

function TeacherForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (teacher: Teacher) => void
}) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    level: 'A1' as TeacherLevel,
    availability: 'AVAILABLE' as TeacherAvailability,
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
    if (form.password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.')
      return
    }
    setSaving(true)
    const result = await createTeacherBrowser({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      password: form.password,
      level: form.level,
      availability: form.availability,
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
      aria-labelledby="teacher-form-title"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="teacher-form-title" className="text-xl font-semibold">
              Nuevo profesor
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Completá los datos para crear el perfil.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-muted-foreground"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {error ? (
          <div className="mt-5">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="teacher-firstName">
            <Input
              id="teacher-firstName"
              required
              value={form.firstName}
              onChange={(event) => update('firstName', event.target.value)}
            />
          </Field>
          <Field label="Apellido" htmlFor="teacher-lastName">
            <Input
              id="teacher-lastName"
              required
              value={form.lastName}
              onChange={(event) => update('lastName', event.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="teacher-email">
            <Input
              id="teacher-email"
              required
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </Field>
          <Field label="Nivel" htmlFor="teacher-level">
            <Select
              id="teacher-level"
              value={form.level}
              onChange={(event) =>
                update('level', event.target.value as TeacherLevel)
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
            label="Contraseña"
            htmlFor="teacher-password"
            hint="Mínimo 12 caracteres"
          >
            <Input
              id="teacher-password"
              required
              type="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
            />
          </Field>
          <Field label="Disponibilidad" htmlFor="teacher-availability">
            <Select
              id="teacher-availability"
              value={form.availability}
              onChange={(event) =>
                update(
                  'availability',
                  event.target.value as TeacherAvailability,
                )
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
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving}>
            {saving ? 'Creando...' : 'Crear profesor'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await listTeachersBrowser()
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      setTeachers([])
      return
    }
    setTeachers(result.data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = teachers.filter((teacher) =>
    `${teacher.firstName} ${teacher.lastName} ${teacher.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <DashboardShell title="Profesores">
      <PageHeader
        eyebrow="Academia"
        title="Profesores"
        description="Gestioná el equipo docente de la academia."
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus />
            Nuevo profesor
          </Button>
        }
      />
      <Card className="mb-5 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            className="pl-10"
            aria-label="Buscar profesores"
            placeholder="Buscar por nombre o email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Card>
      {error ? (
        <div className="mb-5">
          <Alert>{error}</Alert>
          <Button className="mt-3" variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : null}
      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Todavía no hay profesores registrados."
          description="Podés crear el primer perfil docente para comenzar."
          action={
            <Button onClick={() => setShowForm(true)}>
              <UserPlus />
              Crear profesor
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 font-semibold">Profesor</th>
                  <th className="px-5 py-4 font-semibold">Nivel</th>
                  <th className="px-5 py-4 font-semibold">Disponibilidad</th>
                  <th className="px-5 py-4 font-semibold">Estado</th>
                  <th className="px-5 py-4 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((teacher) => (
                  <tr
                    key={teacher.id}
                    className="transition hover:bg-surface-muted/60"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/teachers/${teacher.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {personFullName(teacher)}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {teacher.email}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone="info">{teacher.level}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={availabilityTone(teacher.availability)}>
                        {teacherAvailabilityLabels[teacher.availability]}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={teacher.isActive ? 'success' : 'neutral'}>
                        {teacher.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/teachers/${teacher.id}`}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/8"
                      >
                        <Eye className="size-4" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col divide-y divide-border md:hidden">
            {filtered.map((teacher) => (
              <Link
                key={teacher.id}
                href={`/dashboard/teachers/${teacher.id}`}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {personFullName(teacher)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {teacher.email}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="info">{teacher.level}</Badge>
                    <Badge tone={availabilityTone(teacher.availability)}>
                      {teacherAvailabilityLabels[teacher.availability]}
                    </Badge>
                    <Badge tone={teacher.isActive ? 'success' : 'neutral'}>
                      {teacher.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <Eye className="size-4 shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        </Card>
      )}
      {showForm ? (
        <TeacherForm
          onClose={() => setShowForm(false)}
          onCreated={(teacher) =>
            setTeachers((current) => [teacher, ...current])
          }
        />
      ) : null}
    </DashboardShell>
  )
}
