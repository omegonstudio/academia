'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Eye, UserPlus } from 'lucide-react'
import type { Student, StudentLevel } from '@academia/shared'
import { STUDENT_LEVELS } from '@academia/shared'
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
  createStudentBrowser,
  listStudentsBrowser,
  personFullName,
} from '@/lib/api-browser'

function StudentForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (student: Student) => void
}) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    level: 'A1' as StudentLevel,
    password: '',
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
    const result = await createStudentBrowser({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      level: form.level,
      password: form.password,
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
      aria-labelledby="student-form-title"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="student-form-title" className="text-xl font-semibold">
              Nuevo estudiante
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
          <Field label="Nombre" htmlFor="firstName">
            <Input
              id="firstName"
              required
              value={form.firstName}
              onChange={(event) => update('firstName', event.target.value)}
            />
          </Field>
          <Field label="Apellido" htmlFor="lastName">
            <Input
              id="lastName"
              required
              value={form.lastName}
              onChange={(event) => update('lastName', event.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              required
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </Field>
          <Field label="Nivel" htmlFor="level">
            <Select
              id="level"
              value={form.level}
              onChange={(event) =>
                update('level', event.target.value as StudentLevel)
              }
            >
              {STUDENT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Contraseña"
            htmlFor="password"
            hint="Mínimo 12 caracteres"
          >
            <Input
              id="password"
              required
              type="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving}>
            {saving ? 'Creando...' : 'Crear estudiante'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await listStudentsBrowser()
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      setStudents([])
      return
    }
    setStudents(result.data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = students.filter((student) =>
    `${student.firstName} ${student.lastName} ${student.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <DashboardShell title="Estudiantes">
      <PageHeader
        eyebrow="Academia"
        title="Estudiantes"
        description="Gestioná los estudiantes de la academia."
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus />
            Nuevo estudiante
          </Button>
        }
      />
      <Card className="mb-5 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            className="pl-10"
            aria-label="Buscar estudiantes"
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
          title="Todavía no hay estudiantes registrados."
          description="Podés crear el primer perfil para comenzar a gestionar la academia."
          action={
            <Button onClick={() => setShowForm(true)}>
              <UserPlus />
              Crear estudiante
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 font-semibold">Estudiante</th>
                  <th className="px-5 py-4 font-semibold">Nivel</th>
                  <th className="px-5 py-4 font-semibold">Estado</th>
                  <th className="px-5 py-4 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((student) => (
                  <tr
                    key={student.id}
                    className="transition hover:bg-surface-muted/60"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/students/${student.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {personFullName(student)}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {student.email}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone="info">{student.level}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={student.isActive ? 'success' : 'neutral'}>
                        {student.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/students/${student.id}`}
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
            {filtered.map((student) => (
              <Link
                key={student.id}
                href={`/dashboard/students/${student.id}`}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {personFullName(student)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {student.email}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Badge tone="info">{student.level}</Badge>
                    <Badge tone={student.isActive ? 'success' : 'neutral'}>
                      {student.isActive ? 'Activo' : 'Inactivo'}
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
        <StudentForm
          onClose={() => setShowForm(false)}
          onCreated={(student) =>
            setStudents((current) => [student, ...current])
          }
        />
      ) : null}
    </DashboardShell>
  )
}
