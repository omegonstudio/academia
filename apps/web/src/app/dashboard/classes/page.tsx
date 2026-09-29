'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, WandSparkles } from 'lucide-react'
import type {
  ClassSession,
  Course,
  GenerateClassSessionsResponse,
  Group,
  ScheduleOption,
  Teacher,
} from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { ClassFormDialog } from '@/components/class-form-dialog'
import { ClassGenerationDialog } from '@/components/class-generation-dialog'
import { useSessionUser } from '@/components/session-provider'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Select,
  Skeleton,
} from '@/components/ui/primitives'
import {
  courseServiceTypeLabels,
  listClassSessionsBrowser,
  listCoursesBrowser,
  listGroupsBrowser,
  listScheduleOptionsBrowser,
  listTeachersBrowser,
  personFullName,
} from '@/lib/api-browser'
import { canShowGenerateUi, formatGenerateResultSummary } from '@/lib/class-session-generate'
import {
  classScheduleStatus,
  classScheduleStatusLabels,
  classScheduleStatusTones,
  formatClassDateShort,
  formatClassTime,
  type ClassScheduleStatus,
} from '@/lib/class-session-display'

type ClassRow = ClassSession & {
  groupName: string
  courseName: string
  teacherName: string
  modalityLabel: string
  scheduleStatus: ClassScheduleStatus
}

function ClassListRow({ item }: { item: ClassRow }) {
  return (
    <Link
      href={`/dashboard/classes/${item.id}`}
      className="group grid grid-cols-[84px_1fr_180px_130px_120px_36px] items-center gap-4 border-b border-border px-5 py-4 last:border-0 hover:bg-surface-muted/50"
    >
      <div>
        <p className="text-xs font-bold text-primary">
          {formatClassDateShort(item.startAt)}
        </p>
        <p className="mt-1 text-lg font-semibold">
          {formatClassTime(item.startAt)}
        </p>
      </div>
      <div>
        <p className="font-semibold">{item.courseName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{item.groupName}</p>
      </div>
      <p className="text-sm text-muted-foreground">{item.teacherName}</p>
      <p className="text-sm text-muted-foreground">
        {item.modalityLabel} · {item.durationMinutes} min
      </p>
      <Badge tone={classScheduleStatusTones[item.scheduleStatus]}>
        {classScheduleStatusLabels[item.scheduleStatus]}
      </Badge>
      <ChevronRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  )
}

export default function ClassesPage() {
  const user = useSessionUser()
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ClassScheduleStatus>(
    'all',
  )
  const [dateFilter, setDateFilter] = useState<
    'all' | 'upcoming' | 'past' | 'inactive'
  >('all')
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false)
  const [isGenerationDialogOpen, setIsGenerationDialogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [sessionsResult, groupsResult, coursesResult, teachersResult, schedulesResult] =
      await Promise.all([
        listClassSessionsBrowser(),
        listGroupsBrowser(),
        listCoursesBrowser(),
        listTeachersBrowser(),
        listScheduleOptionsBrowser(),
      ])

    if (!sessionsResult.ok) {
      setLoading(false)
      setError(sessionsResult.message)
      return
    }

    setSessions(sessionsResult.data)
    if (groupsResult.ok) setGroups(groupsResult.data)
    if (coursesResult.ok) setCourses(coursesResult.data)
    if (teachersResult.ok) setTeachers(teachersResult.data)
    if (schedulesResult.ok) setScheduleOptions(schedulesResult.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    const groupById = new Map(groups.map((group) => [group.id, group]))
    const courseById = new Map(courses.map((course) => [course.id, course]))
    const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]))
    const now = new Date()

    return sessions
      .map((session): ClassRow => {
        const group = groupById.get(session.groupId)
        const course = group ? courseById.get(group.courseId) : undefined
        const teacher = session.teacherId
          ? teacherById.get(session.teacherId)
          : undefined
        return {
          ...session,
          groupName: group?.name ?? 'Grupo',
          courseName: course?.name ?? 'Curso',
          teacherName: teacher ? personFullName(teacher) : 'Sin asignar',
          modalityLabel: courseServiceTypeLabels[session.serviceType],
          scheduleStatus: classScheduleStatus(session, now),
        }
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
  }, [sessions, groups, courses, teachers])

  const filtered = useMemo(() => {
    return rows.filter((item) => {
      if (teacherFilter !== 'all' && item.teacherId !== teacherFilter) {
        return false
      }
      if (groupFilter !== 'all' && item.groupId !== groupFilter) return false
      if (statusFilter !== 'all' && item.scheduleStatus !== statusFilter) {
        return false
      }
      if (dateFilter === 'upcoming') {
        return (
          item.scheduleStatus === 'SCHEDULED' ||
          item.scheduleStatus === 'IN_PROGRESS'
        )
      }
      if (dateFilter === 'past') {
        return (
          item.scheduleStatus === 'COMPLETED' ||
          item.scheduleStatus === 'CANCELLED'
        )
      }
      if (dateFilter === 'inactive') return !item.isActive
      return true
    })
  }, [rows, teacherFilter, groupFilter, statusFilter, dateFilter])

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of rows) {
      if (row.teacherId) map.set(row.teacherId, row.teacherName)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [rows])

  function handleCreated(session: ClassSession) {
    setIsClassDialogOpen(false)
    setSessions((current) => [...current, session])
    setSuccess('Clase creada correctamente.')
    window.setTimeout(() => setSuccess(''), 4000)
  }

  function handleGenerated(result: GenerateClassSessionsResponse) {
    setIsGenerationDialogOpen(false)
    setSessions((current) => {
      const known = new Set(current.map((item) => item.id))
      const next = result.classSessions.filter((item) => !known.has(item.id))
      return [...current, ...next]
    })
    setSuccess(formatGenerateResultSummary(result))
    window.setTimeout(() => setSuccess(''), 6000)
  }

  return (
    <DashboardShell title="Clases">
      <PageHeader
        title="Clases"
        description="Organizá y consultá las clases de la academia."
        action={
          <div className="flex flex-wrap gap-2">
            {canShowGenerateUi(user.role) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSuccess('')
                  setIsGenerationDialogOpen(true)
                }}
              >
                <WandSparkles data-icon="inline-start" />
                Generar clases
              </Button>
            )}
            <Button
              onClick={() => {
                setSuccess('')
                setIsClassDialogOpen(true)
              }}
            >
              <Plus data-icon="inline-start" />
              Nueva clase
            </Button>
          </div>
        }
      />

      {success && (
        <div className="mb-5">
          <Alert tone="success">{success}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}

      {isClassDialogOpen && (
        <ClassFormDialog
          groups={groups}
          courses={courses}
          teachers={teachers}
          onClose={() => setIsClassDialogOpen(false)}
          onCreated={handleCreated}
        />
      )}
      {isGenerationDialogOpen && (
        <ClassGenerationDialog
          groups={groups}
          courses={courses}
          teachers={teachers}
          scheduleOptions={scheduleOptions}
          onClose={() => setIsGenerationDialogOpen(false)}
          onCreated={handleGenerated}
        />
      )}

      <Card>
        <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            aria-label="Fecha"
            value={dateFilter}
            onChange={(event) =>
              setDateFilter(
                event.target.value as
                  | 'all'
                  | 'upcoming'
                  | 'past'
                  | 'inactive',
              )
            }
          >
            <option value="all">Todas las fechas</option>
            <option value="upcoming">Próximas</option>
            <option value="past">Pasadas / canceladas</option>
            <option value="inactive">Solo inactivas</option>
          </Select>
          <Select
            aria-label="Profesor"
            value={teacherFilter}
            onChange={(event) => setTeacherFilter(event.target.value)}
          >
            <option value="all">Todos los profesores</option>
            {teacherOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Grupo"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
          >
            <option value="all">Todos los grupos</option>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Estado"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as 'all' | ClassScheduleStatus,
              )
            }
          >
            <option value="all">Todos los estados</option>
            {(
              Object.keys(classScheduleStatusLabels) as ClassScheduleStatus[]
            ).map((key) => (
              <option key={key} value={key}>
                {classScheduleStatusLabels[key]}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              rows.length === 0
                ? 'Todavía no hay clases'
                : 'No hay clases con estos filtros'
            }
            description={
              rows.length === 0
                ? 'Creá una clase o generá un rango desde la franja del grupo.'
                : 'Probá cambiar los filtros.'
            }
            action={
              <Button onClick={() => setIsClassDialogOpen(true)}>
                <Plus data-icon="inline-start" />
                Nueva clase
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <div className="grid grid-cols-[84px_1fr_180px_130px_120px_36px] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Fecha</span>
                <span>Curso / grupo</span>
                <span>Profesor</span>
                <span>Duración</span>
                <span>Estado</span>
                <span />
              </div>
              {filtered.map((item) => (
                <ClassListRow key={item.id} item={item} />
              ))}
            </div>
            <div className="flex flex-col gap-3 p-4 md:hidden">
              {filtered.map((item) => (
                <Link
                  href={`/dashboard/classes/${item.id}`}
                  key={item.id}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-primary">
                        {formatClassDateShort(item.startAt)} ·{' '}
                        {formatClassTime(item.startAt)}
                      </p>
                      <p className="mt-2 font-semibold">{item.courseName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.groupName}
                      </p>
                    </div>
                    <Badge tone={classScheduleStatusTones[item.scheduleStatus]}>
                      {classScheduleStatusLabels[item.scheduleStatus]}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {item.teacherName}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>
    </DashboardShell>
  )
}
