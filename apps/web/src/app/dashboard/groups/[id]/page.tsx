'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit3, UserMinus, UserPlus } from 'lucide-react'
import {
  GROUP_MAX_ACTIVE_ENROLLMENTS,
  type Course,
  type Enrollment,
  type Group,
  type ScheduleOption,
  type Student,
  type Teacher,
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
} from '@/components/ui/primitives'
import {
  assignGroupTeacherBrowser,
  deactivateGroupBrowser,
  enrollStudentInGroupBrowser,
  getCourseBrowser,
  getGroupBrowser,
  listGroupEnrollmentsBrowser,
  listScheduleOptionsBrowser,
  listStudentsBrowser,
  listTeachersBrowser,
  personFullName,
  unassignGroupTeacherBrowser,
  unenrollStudentFromGroupBrowser,
  updateGroupBrowser,
} from '@/lib/api-browser'

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [group, setGroup] = useState<Group | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOption[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [scheduleOptionId, setScheduleOptionId] = useState('')
  const [enrollStudentId, setEnrollStudentId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [
      groupResult,
      teachersResult,
      studentsResult,
      schedulesResult,
      enrollmentsResult,
    ] = await Promise.all([
      getGroupBrowser(id),
      listTeachersBrowser(),
      listStudentsBrowser(),
      listScheduleOptionsBrowser(),
      listGroupEnrollmentsBrowser(id),
    ])

    if (!groupResult.ok) {
      setLoading(false)
      if (groupResult.status === 404) {
        setGroup(null)
        return
      }
      setError(groupResult.message)
      return
    }

    setGroup(groupResult.data)
    setEditName(groupResult.data.name)
    setTeacherId(groupResult.data.teacherId ?? '')
    setScheduleOptionId(groupResult.data.scheduleOptionId ?? '')

    if (teachersResult.ok) setTeachers(teachersResult.data)
    if (studentsResult.ok) setStudents(studentsResult.data)
    if (schedulesResult.ok) setScheduleOptions(schedulesResult.data)
    if (enrollmentsResult.ok) {
      setEnrollments(enrollmentsResult.data)
    } else {
      setEnrollments([])
      setError(enrollmentsResult.message)
    }

    const courseResult = await getCourseBrowser(groupResult.data.courseId)
    setCourse(courseResult.ok ? courseResult.data : null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!loading && !group && !error) {
    notFound()
  }

  const teacherById = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  )
  const studentById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  )
  const scheduleById = useMemo(
    () => new Map(scheduleOptions.map((option) => [option.id, option])),
    [scheduleOptions],
  )

  const enrolledStudentIds = useMemo(
    () => new Set(enrollments.map((item) => item.studentId)),
    [enrollments],
  )

  const availableStudents = students.filter(
    (student) => student.isActive && !enrolledStudentIds.has(student.id),
  )

  const activeTeachers = teachers.filter((teacher) => teacher.isActive)
  const activeSchedules = scheduleOptions.filter((option) => option.isActive)
  const atCapacity = enrollments.length >= GROUP_MAX_ACTIVE_ENROLLMENTS

  const currentTeacher = group?.teacherId
    ? teacherById.get(group.teacherId)
    : undefined
  const currentSchedule = group?.scheduleOptionId
    ? scheduleById.get(group.scheduleOptionId)
    : undefined

  async function saveName() {
    if (!group || saving) return
    const name = editName.trim()
    if (!name) {
      setError('Ingresá el nombre del grupo.')
      return
    }
    setSaving(true)
    setError('')
    const result = await updateGroupBrowser(group.id, { name })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setGroup(result.data)
    setEditing(false)
  }

  async function saveTeacher() {
    if (!group || saving) return
    setSaving(true)
    setError('')
    if (!teacherId) {
      if (!group.teacherId) {
        setSaving(false)
        return
      }
      const result = await unassignGroupTeacherBrowser(group.id)
      setSaving(false)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setGroup({ ...group, teacherId: null })
      return
    }
    const result = await assignGroupTeacherBrowser(group.id, teacherId)
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setGroup({ ...group, teacherId: result.data.teacherId })
  }

  async function saveSchedule() {
    if (!group || saving) return
    setSaving(true)
    setError('')
    const result = await updateGroupBrowser(group.id, {
      scheduleOptionId: scheduleOptionId || null,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setGroup(result.data)
  }

  async function enrollStudent() {
    if (!group || !enrollStudentId || saving) return
    if (atCapacity) {
      setError(
        `El grupo ya tiene ${GROUP_MAX_ACTIVE_ENROLLMENTS} estudiantes. Sacá a alguien antes de inscribir otro.`,
      )
      return
    }
    setSaving(true)
    setError('')
    const result = await enrollStudentInGroupBrowser(
      group.id,
      enrollStudentId,
    )
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEnrollments((current) => [...current, result.data])
    setEnrollStudentId('')
  }

  async function confirmUnenrollStudent() {
    if (!group || !confirmUnenroll || saving) return
    setSaving(true)
    setError('')
    const result = await unenrollStudentFromGroupBrowser(
      group.id,
      confirmUnenroll,
    )
    setSaving(false)
    setConfirmUnenroll(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEnrollments((current) =>
      current.filter((item) => item.studentId !== confirmUnenroll),
    )
  }

  async function confirmSoftDelete() {
    if (!group || saving) return
    setSaving(true)
    setError('')
    const result = await deactivateGroupBrowser(group.id)
    setSaving(false)
    setConfirmDeactivate(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setGroup(result.data)
  }

  return (
    <DashboardShell title="Detalle de grupo">
      <Link
        href="/dashboard/groups"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a grupos
      </Link>
      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : group ? (
        <>
          <PageHeader
            eyebrow="Grupo"
            title={group.name}
            description={course?.name ?? 'Curso asociado'}
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
                {group.isActive ? (
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
              <h2 className="font-semibold">Información del grupo</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Info label="Nombre" value={group.name} />
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <div className="mt-2">
                    <Badge tone={group.isActive ? 'success' : 'neutral'}>
                      {group.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <Info label="Curso" value={course?.name ?? group.courseId} />
                <Info
                  label="Capacidad"
                  value={`${enrollments.length}/${GROUP_MAX_ACTIVE_ENROLLMENTS}`}
                />
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="font-semibold">Profesor y horario</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Info
                  label="Profesor"
                  value={
                    currentTeacher
                      ? personFullName(currentTeacher)
                      : 'Sin asignar'
                  }
                />
                <Info
                  label="Horario"
                  value={currentSchedule?.label ?? 'Sin horario'}
                />
              </div>
            </Card>
          </div>

          {editing ? (
            <Card className="mt-5 p-6">
              <h2 className="font-semibold">Editar nombre</h2>
              <div className="mt-5 max-w-md">
                <Field label="Nombre" htmlFor="edit-group-name">
                  <Input
                    id="edit-group-name"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                </Field>
              </div>
              <Button
                className="mt-5"
                onClick={() => void saveName()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar nombre'}
              </Button>
            </Card>
          ) : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="font-semibold">Asignar profesor</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Un profesor actual por grupo (sin historial).
              </p>
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Field label="Profesor" htmlFor="group-teacher-select">
                    <Select
                      id="group-teacher-select"
                      value={teacherId}
                      onChange={(event) => setTeacherId(event.target.value)}
                    >
                      <option value="">Sin asignar</option>
                      {activeTeachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {personFullName(teacher)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Button onClick={() => void saveTeacher()} disabled={saving}>
                  Guardar profesor
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold">Franja horaria</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Elegí una opción activa del catálogo.
              </p>
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Field label="Horario" htmlFor="group-schedule-select">
                    <Select
                      id="group-schedule-select"
                      value={scheduleOptionId}
                      onChange={(event) =>
                        setScheduleOptionId(event.target.value)
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
                </div>
                <Button onClick={() => void saveSchedule()} disabled={saving}>
                  Guardar horario
                </Button>
              </div>
            </Card>
          </div>

          <Card className="mt-5 p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold">Estudiantes inscritos</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Máximo {GROUP_MAX_ACTIVE_ENROLLMENTS} activos por grupo.
                </p>
              </div>
              <Badge tone={atCapacity ? 'warning' : 'info'}>
                {enrollments.length}/{GROUP_MAX_ACTIVE_ENROLLMENTS}
              </Badge>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label="Inscribir estudiante" htmlFor="enroll-student">
                  <Select
                    id="enroll-student"
                    value={enrollStudentId}
                    onChange={(event) => setEnrollStudentId(event.target.value)}
                    disabled={atCapacity || !group.isActive}
                  >
                    <option value="">
                      {atCapacity
                        ? 'Cupo completo'
                        : 'Seleccioná un estudiante'}
                    </option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {personFullName(student)} · {student.level}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                onClick={() => void enrollStudent()}
                disabled={
                  saving ||
                  !enrollStudentId ||
                  atCapacity ||
                  !group.isActive
                }
              >
                <UserPlus />
                Inscribir
              </Button>
            </div>

            {enrollments.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                Todavía no hay estudiantes inscritos en este grupo.
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-border">
                {enrollments.map((enrollment) => {
                  const student = studentById.get(enrollment.studentId)
                  return (
                    <li
                      key={enrollment.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {student
                            ? personFullName(student)
                            : enrollment.studentId}
                        </p>
                        {student ? (
                          <p className="text-xs text-muted-foreground">
                            Nivel {student.level} · {student.email}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmUnenroll(enrollment.studentId)
                        }
                        disabled={saving}
                      >
                        <UserMinus />
                        Quitar
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {confirmDeactivate ? (
            <ConfirmDialog
              title="¿Querés desactivar este grupo?"
              description="El grupo dejará de estar activo en la academia."
              confirmLabel="Desactivar"
              onConfirm={() => {
                void confirmSoftDelete()
              }}
              onClose={() => setConfirmDeactivate(false)}
            />
          ) : null}
          {confirmUnenroll ? (
            <ConfirmDialog
              title="¿Querés dar de baja a este estudiante?"
              description="La inscripción se desactiva (baja lógica)."
              confirmLabel="Quitar"
              onConfirm={() => {
                void confirmUnenrollStudent()
              }}
              onClose={() => setConfirmUnenroll(null)}
            />
          ) : null}
        </>
      ) : (
        <div>
          <Alert>{error || 'No pudimos cargar el grupo.'}</Alert>
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
