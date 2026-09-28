'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  durationMinutesForServiceType,
  zonedLocalDateTimeToUtc,
  type CivilDate,
  type ClassSession,
  type Course,
  type Group,
  type Teacher,
} from '@academia/shared'
import { isCivilDateInput } from '@/lib/class-session-generate'
import { X } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
} from '@/components/ui/primitives'
import {
  courseServiceTypeLabels,
  createClassSessionBrowser,
  personFullName,
} from '@/lib/api-browser'
import { CALENDAR_DISPLAY_TIMEZONE } from '@/lib/calendar'

type ClassForm = {
  groupId: string
  date: string
  startTime: string
  meetingUrl: string
}

const initialForm: ClassForm = {
  groupId: '',
  date: '',
  startTime: '',
  meetingUrl: '',
}

function formatSummaryDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${value}T12:00:00`))
}

export function ClassFormDialog({
  groups,
  courses,
  teachers,
  onClose,
  onCreated,
  initialDate,
}: {
  groups: Group[]
  courses: Course[]
  teachers: Teacher[]
  onClose: () => void
  onCreated: (item: ClassSession) => void
  initialDate?: string
}) {
  const [form, setForm] = useState<ClassForm>(() => ({
    ...initialForm,
    date: initialDate ?? '',
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof ClassForm, string>>>(
    {},
  )
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeGroups = useMemo(
    () => groups.filter((group) => group.isActive),
    [groups],
  )
  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  )
  const teacherById = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  )

  const group = activeGroups.find((item) => item.id === form.groupId)
  const course = group ? courseById.get(group.courseId) : undefined
  const teacher = group?.teacherId
    ? teacherById.get(group.teacherId)
    : undefined
  const durationMinutes = course
    ? durationMinutesForServiceType(course.serviceType)
    : null

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isSubmitting, onClose])

  function update<K extends keyof ClassForm>(key: K, value: ClassForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    if (submitError) setSubmitError('')
  }

  function validate() {
    const next: typeof errors = {}
    if (!form.groupId) next.groupId = 'Grupo obligatorio'
    if (!form.date) next.date = 'Fecha obligatoria'
    if (!form.startTime) next.startTime = 'Hora de inicio obligatoria'
    if (form.meetingUrl && !/^https:\/\//i.test(form.meetingUrl)) {
      next.meetingUrl = 'La URL debe comenzar con https://'
    }
    if (group && !group.scheduleOptionId) {
      next.groupId =
        'Este grupo no tiene franja horaria. Asignala antes de crear la clase.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (isSubmitting || !validate() || !group) return

    if (!isCivilDateInput(form.date)) {
      setSubmitError('Usá una fecha válida.')
      return
    }
    let startAt: string
    try {
      startAt = zonedLocalDateTimeToUtc(
        form.date as CivilDate,
        form.startTime,
        CALENDAR_DISPLAY_TIMEZONE,
      ).toISOString()
    } catch {
      setSubmitError('No pudimos interpretar la fecha y hora elegidas.')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    const result = await createClassSessionBrowser({
      groupId: group.id,
      startAt,
      ...(form.meetingUrl.trim()
        ? { meetingUrl: form.meetingUrl.trim() }
        : {}),
    })
    setIsSubmitting(false)
    if (!result.ok) {
      setSubmitError(result.message)
      return
    }
    onCreated(result.data)
  }

  return (
    <div
      className="fixed inset-0 z-50 isolate flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-dialog-title"
    >
      <div className="max-h-[calc(100vh-1.5rem)] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="class-dialog-title" className="text-xl font-semibold">
              Nueva clase
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Programá una clase. La duración sale del tipo de servicio del
              curso.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar"
          >
            <X />
          </Button>
        </div>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
          {submitError && <Alert>{submitError}</Alert>}
          {Object.keys(errors).length > 0 && !submitError && (
            <Alert>Revisá los campos indicados para continuar.</Alert>
          )}
          <Field label="Grupo" htmlFor="class-group" error={errors.groupId}>
            <Select
              id="class-group"
              value={form.groupId}
              onChange={(event) => update('groupId', event.target.value)}
              aria-invalid={Boolean(errors.groupId)}
            >
              <option value="">Seleccioná un grupo</option>
              {activeGroups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          {group && (
            <Card className="grid gap-3 bg-surface-muted/45 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Curso</p>
                <p className="mt-1 text-sm font-semibold">
                  {course?.name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Profesor</p>
                <p className="mt-1 text-sm font-semibold">
                  {teacher ? personFullName(teacher) : 'Sin asignar'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Modalidad</p>
                <p className="mt-1 text-sm font-semibold">
                  {course
                    ? courseServiceTypeLabels[course.serviceType]
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duración</p>
                <p className="mt-1 text-sm font-semibold">
                  {durationMinutes ? `${durationMinutes} min` : '—'}
                </p>
              </div>
            </Card>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fecha" htmlFor="class-date" error={errors.date}>
              <Input
                id="class-date"
                type="date"
                value={form.date}
                onChange={(event) => update('date', event.target.value)}
                aria-invalid={Boolean(errors.date)}
              />
            </Field>
            <Field
              label="Hora de inicio"
              htmlFor="class-start"
              error={errors.startTime}
            >
              <Input
                id="class-start"
                type="time"
                value={form.startTime}
                onChange={(event) => update('startTime', event.target.value)}
                aria-invalid={Boolean(errors.startTime)}
              />
            </Field>
          </div>
          <Field
            label="Enlace de videollamada"
            htmlFor="class-meeting"
            error={errors.meetingUrl}
            hint="Opcional · debe ser https://"
          >
            <Input
              id="class-meeting"
              type="url"
              placeholder="https://..."
              value={form.meetingUrl}
              onChange={(event) => update('meetingUrl', event.target.value)}
              aria-invalid={Boolean(errors.meetingUrl)}
            />
          </Field>
          <Card className="border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-semibold">Resumen</p>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                <strong className="text-foreground">Curso:</strong>{' '}
                {course?.name ?? '—'}
              </p>
              <p>
                <strong className="text-foreground">Grupo:</strong>{' '}
                {group?.name ?? '—'}
              </p>
              <p>
                <strong className="text-foreground">Profesor:</strong>{' '}
                {teacher ? personFullName(teacher) : '—'}
              </p>
              <p>
                <strong className="text-foreground">Fecha:</strong>{' '}
                {formatSummaryDate(form.date)}
              </p>
              <p>
                <strong className="text-foreground">Inicio:</strong>{' '}
                {form.startTime || '—'}
              </p>
              <p>
                <strong className="text-foreground">Duración:</strong>{' '}
                {durationMinutes ? `${durationMinutes} minutos` : '—'}
              </p>
            </div>
          </Card>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear clase'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
