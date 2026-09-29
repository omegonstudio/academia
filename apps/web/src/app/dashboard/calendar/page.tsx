'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type {
  ClassSession,
  ClassSessionCalendarEvent,
  Course,
  Group,
  Teacher,
} from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { ClassFormDialog } from '@/components/class-form-dialog'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives'
import {
  listClassSessionCalendarBrowser,
  listCoursesBrowser,
  listGroupsBrowser,
  listTeachersBrowser,
  personFullName,
} from '@/lib/api-browser'
import {
  CALENDAR_DISPLAY_TIMEZONE,
  civilDateInTimeZone,
  civilMonthRange,
  formatDayHeading,
  formatMonthHeading,
  formatSessionTimeRange,
  groupSessionsByCivilDay,
  serviceTypeLabel,
  shiftCivilMonth,
  todayCivilDate,
  type CivilMonth,
} from '@/lib/calendar'

export default function CalendarPage() {
  const [month, setMonth] = useState<CivilMonth>(() => {
    const today = todayCivilDate()
    const [year, monthNumber] = today.split('-').map(Number)
    return { year: year!, month: monthNumber! }
  })
  const [sessions, setSessions] = useState<ClassSessionCalendarEvent[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false)
  const [newClassDate, setNewClassDate] = useState<string | undefined>()

  const range = useMemo(() => civilMonthRange(month), [month])
  const today = todayCivilDate()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [calendarResult, groupsResult, coursesResult, teachersResult] =
      await Promise.all([
        listClassSessionCalendarBrowser(range.from, range.to),
        listGroupsBrowser(),
        listCoursesBrowser(),
        listTeachersBrowser(),
      ])

    if (!calendarResult.ok) {
      setLoading(false)
      setError(calendarResult.message)
      return
    }

    setSessions(calendarResult.data.classSessions)
    if (groupsResult.ok) setGroups(groupsResult.data)
    if (coursesResult.ok) setCourses(coursesResult.data)
    if (teachersResult.ok) setTeachers(teachersResult.data)
    setLoading(false)
  }, [range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  const byDay = useMemo(
    () => groupSessionsByCivilDay(sessions, CALENDAR_DISPLAY_TIMEZONE),
    [sessions],
  )

  function openNew(date?: string) {
    setNewClassDate(date)
    setIsClassDialogOpen(true)
  }

  function handleCreated(session: ClassSession) {
    setIsClassDialogOpen(false)
    const day = civilDateInTimeZone(session.startAt)
    if (day >= range.from && day <= range.to) {
      void load()
    }
    setSuccess('Clase creada correctamente.')
    window.setTimeout(() => setSuccess(''), 4000)
  }

  return (
    <DashboardShell title="Calendario">
      <PageHeader
        title="Calendario"
        description="Agenda mensual de clases activas (zona horaria de la academia)."
        action={
          <Button onClick={() => openNew()}>
            <Plus data-icon="inline-start" />
            Nueva clase
          </Button>
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
          initialDate={newClassDate}
          onClose={() => setIsClassDialogOpen(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth((current) => shiftCivilMonth(current, -1))}
            aria-label="Mes anterior"
          >
            <ChevronLeft data-icon="inline-start" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const [year, monthNumber] = today.split('-').map(Number)
              setMonth({ year: year!, month: monthNumber! })
            }}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth((current) => shiftCivilMonth(current, 1))}
            aria-label="Mes siguiente"
          >
            Siguiente
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
        <p className="text-lg font-semibold capitalize">
          {formatMonthHeading(month)}
        </p>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {sessions.length} clases
        </span>{' '}
        entre {range.from} y {range.to}
      </p>

      {loading ? (
        <Card className="flex flex-col gap-3 p-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </Card>
      ) : byDay.length === 0 ? (
        <EmptyState
          title="No hay clases en este mes"
          description="Creá una clase o navegá a otro mes."
          action={
            <Button onClick={() => openNew()}>
              <Plus data-icon="inline-start" />
              Nueva clase
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {byDay.map(({ day, sessions: daySessions }) => (
            <Card key={day} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-4 py-3">
                <div>
                  <p
                    className={`text-sm font-semibold capitalize ${
                      day === today ? 'text-primary' : ''
                    }`}
                  >
                    {formatDayHeading(day)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {daySessions.length}{' '}
                    {daySessions.length === 1 ? 'clase' : 'clases'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openNew(day)}
                  aria-label={`Nueva clase el ${formatDayHeading(day)}`}
                >
                  <Plus data-icon="inline-start" />
                  Nueva
                </Button>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {daySessions.map((item) => (
                  <CalendarSessionRow key={item.id} item={item} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}

function CalendarSessionRow({ item }: { item: ClassSessionCalendarEvent }) {
  const teacherLabel = item.teacher
    ? personFullName(item.teacher)
    : 'Sin asignar'
  return (
    <Link
      href={`/dashboard/classes/${item.id}`}
      className="flex flex-col gap-2 p-4 transition hover:bg-surface-muted/50 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-40 text-sm font-bold text-primary">
        {formatSessionTimeRange(item.startAt, item.endAt)
          .split(' · ')
          .slice(1)
          .join(' · ')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{item.group.course.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {teacherLabel} · {item.group.name}
        </p>
      </div>
      <Badge tone="info">{serviceTypeLabel(item.group.course.serviceType)}</Badge>
    </Link>
  )
}
