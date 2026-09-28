'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Plus, Search, Users } from 'lucide-react'
import {
  GROUP_MAX_ACTIVE_ENROLLMENTS,
  type Course,
  type Group,
  type ScheduleOption,
  type Teacher,
} from '@academia/shared'
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
  assignGroupTeacherBrowser,
  createGroupBrowser,
  listCoursesBrowser,
  listGroupEnrollmentsBrowser,
  listGroupsBrowser,
  listScheduleOptionsBrowser,
  listTeachersBrowser,
  personFullName,
  updateGroupBrowser,
} from '@/lib/api-browser'

type GroupRow = Group & {
  courseName: string
  teacherName: string
  scheduleLabel: string
  studentCount: number
}

function NewGroupDialog({
  courses,
  teachers,
  scheduleOptions,
  onClose,
  onCreated,
}: {
  courses: Course[]
  teachers: Teacher[]
  scheduleOptions: ScheduleOption[]
  onClose: () => void
  onCreated: (group: Group) => void
}) {
  const [form, setForm] = useState({
    name: '',
    courseId: '',
    teacherId: '',
    scheduleOptionId: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const activeCourses = courses.filter((course) => course.isActive)
  const activeTeachers = teachers.filter((teacher) => teacher.isActive)
  const activeSchedules = scheduleOptions.filter((option) => option.isActive)
  const selectedCourse = activeCourses.find(
    (course) => course.id === form.courseId,
  )
  const selectedTeacher = activeTeachers.find(
    (teacher) => teacher.id === form.teacherId,
  )
  const selectedSchedule = activeSchedules.find(
    (option) => option.id === form.scheduleOptionId,
  )

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setError('')
    if (!form.name.trim()) {
      setError('Ingresá el nombre del grupo.')
      return
    }
    if (!form.courseId) {
      setError('Seleccioná un curso.')
      return
    }

    setSaving(true)
    const created = await createGroupBrowser({
      courseId: form.courseId,
      name: form.name.trim(),
    })
    if (!created.ok) {
      setSaving(false)
      setError(created.message)
      return
    }

    let group = created.data

    if (form.teacherId) {
      const teacherResult = await assignGroupTeacherBrowser(
        group.id,
        form.teacherId,
      )
      if (!teacherResult.ok) {
        setSaving(false)
        setError(
          `Grupo creado, pero no se pudo asignar el profesor: ${teacherResult.message}`,
        )
        onCreated(group)
        return
      }
      group = { ...group, teacherId: teacherResult.data.teacherId }
    }

    if (form.scheduleOptionId) {
      const scheduleResult = await updateGroupBrowser(group.id, {
        scheduleOptionId: form.scheduleOptionId,
      })
      if (!scheduleResult.ok) {
        setSaving(false)
        setError(
          `Grupo creado, pero no se pudo asignar el horario: ${scheduleResult.message}`,
        )
        onCreated(group)
        return
      }
      group = scheduleResult.data
    }

    setSaving(false)
    onCreated(group)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 isolate flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-dialog-title"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="max-h-[calc(100vh-1.5rem)] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="group-dialog-title" className="text-xl font-semibold">
              Nuevo grupo
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Asociá el grupo a un curso activo. Profesor y horario son
              opcionales.
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
          <Field label="Nombre del grupo" htmlFor="group-name">
            <Input
              id="group-name"
              required
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Ej. Conversación B1 — Grupo A"
            />
          </Field>
          <Field label="Curso" htmlFor="group-course">
            <Select
              id="group-course"
              required
              value={form.courseId}
              onChange={(event) => update('courseId', event.target.value)}
            >
              <option value="">Seleccioná un curso</option>
              {activeCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Profesor" htmlFor="group-teacher" hint="Opcional">
            <Select
              id="group-teacher"
              value={form.teacherId}
              onChange={(event) => update('teacherId', event.target.value)}
            >
              <option value="">Sin asignar</option>
              {activeTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {personFullName(teacher)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Franja horaria"
            htmlFor="group-schedule"
            hint="Opcional. Catálogo de schedule-options."
          >
            <Select
              id="group-schedule"
              value={form.scheduleOptionId}
              onChange={(event) =>
                update('scheduleOptionId', event.target.value)
              }
            >
              <option value="">Sin horario</option>
              {activeSchedules.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Capacidad"
            htmlFor="group-capacity"
            hint="Máximo fijo por regla de negocio."
          >
            <Input
              id="group-capacity"
              value={`${GROUP_MAX_ACTIVE_ENROLLMENTS} estudiantes`}
              disabled
            />
          </Field>
          <Card className="bg-surface-muted p-4">
            <p className="text-sm font-semibold">Resumen</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Grupo</dt>
                <dd className="font-medium">{form.name || 'Sin definir'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Curso</dt>
                <dd className="font-medium">
                  {selectedCourse?.name || 'Sin seleccionar'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Profesor</dt>
                <dd className="font-medium">
                  {selectedTeacher
                    ? personFullName(selectedTeacher)
                    : 'Sin asignar'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Horario</dt>
                <dd className="font-medium">
                  {selectedSchedule?.label || 'Sin horario'}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creando...' : 'Crear grupo'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function GroupsPage() {
  const [rows, setRows] = useState<GroupRow[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOption[]>([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [groupsResult, coursesResult, teachersResult, schedulesResult] =
      await Promise.all([
        listGroupsBrowser(),
        listCoursesBrowser(),
        listTeachersBrowser(),
        listScheduleOptionsBrowser(),
      ])

    if (!groupsResult.ok) {
      setLoading(false)
      setError(groupsResult.message)
      setRows([])
      return
    }
    if (!coursesResult.ok) {
      setLoading(false)
      setError(coursesResult.message)
      return
    }
    if (!teachersResult.ok) {
      setLoading(false)
      setError(teachersResult.message)
      return
    }

    setCourses(coursesResult.data)
    setTeachers(teachersResult.data)
    setScheduleOptions(
      schedulesResult.ok ? schedulesResult.data : [],
    )

    const courseById = new Map(
      coursesResult.data.map((course) => [course.id, course]),
    )
    const teacherById = new Map(
      teachersResult.data.map((teacher) => [teacher.id, teacher]),
    )
    const scheduleById = new Map(
      (schedulesResult.ok ? schedulesResult.data : []).map((option) => [
        option.id,
        option,
      ]),
    )

    const nextRows: GroupRow[] = []
    for (const group of groupsResult.data) {
      const enrollments = await listGroupEnrollmentsBrowser(group.id)
      const teacher = group.teacherId
        ? teacherById.get(group.teacherId)
        : undefined
      const schedule = group.scheduleOptionId
        ? scheduleById.get(group.scheduleOptionId)
        : undefined
      nextRows.push({
        ...group,
        courseName: courseById.get(group.courseId)?.name ?? 'Curso',
        teacherName: teacher ? personFullName(teacher) : 'Sin asignar',
        scheduleLabel: schedule?.label ?? 'Sin horario',
        studentCount: enrollments.ok ? enrollments.data.length : 0,
      })
    }
    setRows(nextRows)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = rows.filter((row) =>
    `${row.name} ${row.courseName} ${row.teacherName} ${row.scheduleLabel}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <DashboardShell title="Grupos">
      <PageHeader
        eyebrow="Academia"
        title="Grupos"
        description="Coordiná cursos, profesores, horarios e inscripciones."
        action={
          <Button
            onClick={() => {
              setSuccess(false)
              setShowForm(true)
            }}
          >
            <Plus />
            Nuevo grupo
          </Button>
        }
      />
      <Card className="mb-5 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            className="pl-10"
            aria-label="Buscar grupos"
            placeholder="Buscar por nombre, curso, profesor u horario"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Card>
      {success ? (
        <div className="mb-5">
          <Alert tone="success">Grupo creado correctamente.</Alert>
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
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Todavía no hay grupos registrados."
          description="Creá el primer grupo y asociarlo a un curso activo."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Users />
              Crear grupo
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((group) => (
            <Link
              href={`/dashboard/groups/${group.id}`}
              key={group.id}
              className="group rounded-2xl border border-border bg-surface p-5 transition hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary">
                    {group.courseName}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold group-hover:text-primary">
                    {group.name}
                  </h3>
                </div>
                <Badge tone={group.isActive ? 'success' : 'neutral'}>
                  {group.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:grid-cols-2">
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  {group.studentCount}/{GROUP_MAX_ACTIVE_ENROLLMENTS}{' '}
                  estudiantes
                </span>
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  {group.scheduleLabel}
                </span>
              </div>
              <p className="mt-4 text-sm">
                Profesor:{' '}
                <span className="font-medium">{group.teacherName}</span>
              </p>
            </Link>
          ))}
        </div>
      )}
      {showForm ? (
        <NewGroupDialog
          courses={courses}
          teachers={teachers}
          scheduleOptions={scheduleOptions}
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
