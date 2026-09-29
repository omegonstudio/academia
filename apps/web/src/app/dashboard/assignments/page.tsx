'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Search, UserPlus, X } from 'lucide-react'
import type { Student, Teacher } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Alert, Badge, Button, Skeleton } from '@/components/ui/primitives'
import {
  assignTeacherBrowser,
  getStudentTeacherBrowser,
  listStudentsBrowser,
  listTeachersBrowser,
  personFullName,
  teacherAvailabilityLabels,
} from '@/lib/api-browser'

type AssignmentRow = {
  studentId: string
  studentName: string
  studentLevel: Student['level']
  teacherId?: string
  teacherName?: string
  status: 'ASSIGNED' | 'UNASSIGNED'
}

export default function AssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | AssignmentRow['status']>('ALL')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [studentsResult, teachersResult] = await Promise.all([
      listStudentsBrowser(),
      listTeachersBrowser(),
    ])
    if (!studentsResult.ok) {
      setLoading(false)
      setError(studentsResult.message)
      return
    }
    if (!teachersResult.ok) {
      setLoading(false)
      setError(teachersResult.message)
      return
    }
    setStudents(studentsResult.data)
    setTeachers(teachersResult.data)

    const teacherById = new Map(
      teachersResult.data.map((teacher) => [teacher.id, teacher]),
    )
    const nextRows: AssignmentRow[] = []
    for (const student of studentsResult.data) {
      const assignment = await getStudentTeacherBrowser(student.id)
      if (assignment.ok && assignment.data) {
        const teacher = teacherById.get(assignment.data.teacherId)
        nextRows.push({
          studentId: student.id,
          studentName: personFullName(student),
          studentLevel: student.level,
          teacherId: assignment.data.teacherId,
          teacherName: teacher ? personFullName(teacher) : undefined,
          status: 'ASSIGNED',
        })
      } else {
        nextRows.push({
          studentId: student.id,
          studentName: personFullName(student),
          studentLevel: student.level,
          status: 'UNASSIGNED',
        })
      }
    }
    setRows(nextRows)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const matchesQuery =
          `${row.studentName} ${row.teacherName ?? ''}`
            .toLowerCase()
            .includes(query.toLowerCase())
        return matchesQuery && (status === 'ALL' || row.status === status)
      }),
    [rows, query, status],
  )

  async function saveAssignment() {
    if (!selectedStudent || !selectedTeacher || saving) return
    setSaving(true)
    setError('')
    const result = await assignTeacherBrowser(
      selectedStudent,
      selectedTeacher,
    )
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setIsFormOpen(false)
    setSelectedStudent('')
    setSelectedTeacher('')
    await load()
  }

  return (
    <DashboardShell title="Asignaciones">
      <PageHeader
        title="Asignaciones"
        description="Gestioná qué profesor acompaña a cada estudiante."
        action={
          <Button
            onClick={() => {
              setSelectedStudent('')
              setSelectedTeacher('')
              setIsFormOpen(true)
            }}
          >
            <UserPlus data-icon="inline-start" />
            Nueva asignación
          </Button>
        }
      />
      {error ? (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar estudiante o profesor</span>
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar estudiante o profesor"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as typeof status)
            }
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ASSIGNED">Asignado</option>
            <option value="UNASSIGNED">Sin asignar</option>
          </select>
        </div>
        {loading ? (
          <div className="mt-5 grid gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <>
            <div className="mt-5 hidden grid-cols-[1.3fr_.6fr_1.2fr_.7fr_auto] gap-4 border-b border-border px-3 pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Estudiante</span>
              <span>Nivel</span>
              <span>Profesor</span>
              <span>Estado</span>
              <span />
            </div>
            <div className="flex flex-col divide-y divide-border">
              {filtered.map((row) => (
                <div
                  key={row.studentId}
                  className="grid gap-3 px-3 py-4 md:grid-cols-[1.3fr_.6fr_1.2fr_.7fr_auto] md:items-center md:gap-4"
                >
                  <div>
                    <p className="font-medium">{row.studentName}</p>
                    <p className="text-xs text-muted-foreground md:hidden">
                      Nivel {row.studentLevel}
                    </p>
                  </div>
                  <span className="hidden text-sm text-muted-foreground md:block">
                    {row.studentLevel}
                  </span>
                  <div className="text-sm">
                    {row.teacherName ?? (
                      <span className="text-muted-foreground">
                        Sin profesor asignado
                      </span>
                    )}
                  </div>
                  <Badge
                    tone={row.status === 'ASSIGNED' ? 'success' : 'neutral'}
                  >
                    {row.status === 'ASSIGNED' ? 'Asignado' : 'Sin asignar'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedStudent(row.studentId)
                      setSelectedTeacher(row.teacherId ?? '')
                      setIsFormOpen(true)
                    }}
                  >
                    {row.status === 'ASSIGNED' ? 'Cambiar' : 'Asignar'}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      {isFormOpen ? (
        <div className="fixed inset-0 z-50 isolate flex items-center justify-center bg-foreground/50 p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-title"
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="assignment-title" className="text-xl font-semibold">
                  {selectedStudent ? 'Cambiar profesor' : 'Nueva asignación'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Elegí el estudiante y el profesor.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Estudiante
                <select
                  value={selectedStudent}
                  onChange={(event) => setSelectedStudent(event.target.value)}
                  className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
                >
                  <option value="">Seleccionar estudiante</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {personFullName(student)} · {student.level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Profesor
                <select
                  value={selectedTeacher}
                  onChange={(event) => setSelectedTeacher(event.target.value)}
                  className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
                >
                  <option value="">Seleccionar profesor</option>
                  {teachers
                    .filter((teacher) => teacher.isActive)
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {personFullName(teacher)} ·{' '}
                        {teacherAvailabilityLabels[teacher.availability]}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  void saveAssignment()
                }}
                disabled={!selectedStudent || !selectedTeacher || saving}
              >
                <Check data-icon="inline-start" />
                {saving ? 'Guardando...' : 'Confirmar asignación'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  )
}
