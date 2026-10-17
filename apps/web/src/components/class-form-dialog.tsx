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
  Textarea,
} from '@/components/ui/primitives'
import {
  courseServiceTypeLabels,
  createClassSessionBrowser,
  getGoogleMeetStatusBrowser,
  getZoomStatusBrowser,
  personFullName,
} from '@/lib/api-browser'
import { CALENDAR_DISPLAY_TIMEZONE } from '@/lib/calendar'

type MeetingPlatform = 'none' | 'meet' | 'zoom' | 'manual'

type ClassForm = {
  groupId: string
  date: string
  startTime: string
  meetingUrl: string
  meetingDescription: string
  meetingPlatform: MeetingPlatform
}

const initialForm: ClassForm = {
  groupId: '',
  date: '',
  startTime: '',
  meetingUrl: '',
  meetingDescription: '',
  meetingPlatform: 'none',
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
  onCreated: (
    item: ClassSession,
    meta?: {
      meetCreationFailed?: boolean
      zoomCreationFailed?: boolean
      calendarSyncFailed?: boolean
    },
  ) => void
  initialDate?: string
}) {
  const [form, setForm] = useState<ClassForm>(() => ({
    ...initialForm,
    date: initialDate ?? '',
  }))
  const [errors, setErrors] = useState<
    Partial<Record<keyof ClassForm, string>>
  >({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [meetConfigured, setMeetConfigured] = useState(false)
  const [zoomConfigured, setZoomConfigured] = useState(false)

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

  useEffect(() => {
    void (async () => {
      const [meet, zoom] = await Promise.all([
        getGoogleMeetStatusBrowser(),
        getZoomStatusBrowser(),
      ])
      if (meet.ok) setMeetConfigured(meet.data.configured)
      if (zoom.ok) setZoomConfigured(zoom.data.configured)
    })()
  }, [])

  function update<K extends keyof ClassForm>(key: K, value: ClassForm[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'meetingPlatform') {
        if (value === 'meet' || value === 'zoom') {
          next.meetingUrl = ''
        }
      }
      return next
    })
    setErrors((current) => ({ ...current, [key]: undefined }))
    if (submitError) setSubmitError('')
  }

  function validate() {
    const next: typeof errors = {}
    if (!form.groupId) next.groupId = 'Grupo obligatorio'
    if (!form.date) next.date = 'Fecha obligatoria'
    if (!form.startTime) next.startTime = 'Hora de inicio obligatoria'
    if (form.meetingPlatform === 'meet' && !meetConfigured) {
      next.meetingPlatform =
        'Google Meet no está configurado en el servidor.'
    }
    if (form.meetingPlatform === 'zoom' && !zoomConfigured) {
      next.meetingPlatform = 'Zoom no está configurado en el servidor.'
    }
    if (
      (form.meetingPlatform === 'meet' || form.meetingPlatform === 'zoom') &&
      form.date &&
      form.startTime &&
      isCivilDateInput(form.date)
    ) {
      try {
        const startAtMs = zonedLocalDateTimeToUtc(
          form.date as CivilDate,
          form.startTime,
          CALENDAR_DISPLAY_TIMEZONE,
        ).getTime()
        if (startAtMs < Date.now()) {
          next.meetingPlatform =
            'No se puede crear una reunión automática para una clase en el pasado.'
        }
      } catch {
        /* date/time errors are handled in submit */
      }
    }
    if (
      form.meetingPlatform === 'manual' &&
      form.meetingUrl &&
      !/^https:\/\//i.test(form.meetingUrl)
    ) {
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
    const description = form.meetingDescription.trim()
    const result = await createClassSessionBrowser({
      groupId: group.id,
      startAt,
      ...(description ? { meetingDescription: description } : {}),
      ...(form.meetingPlatform === 'meet'
        ? { createGoogleMeet: true }
        : form.meetingPlatform === 'zoom'
          ? { createZoom: true }
          : form.meetingPlatform === 'manual' && form.meetingUrl.trim()
            ? { meetingUrl: form.meetingUrl.trim() }
            : {}),
    })
    setIsSubmitting(false)
    if (!result.ok) {
      setSubmitError(result.message)
      return
    }
    onCreated(result.data, {
      ...(result.meetCreationFailed ? { meetCreationFailed: true } : {}),
      ...(result.zoomCreationFailed ? { zoomCreationFailed: true } : {}),
      ...(result.calendarSyncFailed ? { calendarSyncFailed: true } : {}),
    })
  }

  const platformLabel =
    form.meetingPlatform === 'meet'
      ? 'Google Meet (automático)'
      : form.meetingPlatform === 'zoom'
        ? 'Zoom (automático)'
        : form.meetingPlatform === 'manual'
          ? form.meetingUrl.trim() || 'Enlace manual'
          : 'Sin reunión automática'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-form-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="class-form-title" className="text-lg font-semibold">
              Nueva clase
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Programá una clase para un grupo activo.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {submitError ? (
          <div className="mb-4">
            <Alert tone="danger">{submitError}</Alert>
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={submit}>
          <Field label="Grupo" htmlFor="class-group" error={errors.groupId}>
            <Select
              id="class-group"
              value={form.groupId}
              onChange={(event) => update('groupId', event.target.value)}
              aria-invalid={Boolean(errors.groupId)}
            >
              <option value="">Elegí un grupo</option>
              {activeGroups.map((item) => {
                const itemCourse = courseById.get(item.courseId)
                return (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {itemCourse
                      ? ` · ${itemCourse.name} (${courseServiceTypeLabels[itemCourse.serviceType]})`
                      : ''}
                  </option>
                )
              })}
            </Select>
          </Field>

          {group && (
            <Card className="border-border/80 bg-surface-muted/20 p-4 text-sm text-muted-foreground">
              <div className="grid gap-1 sm:grid-cols-2">
                <p>
                  <strong className="text-foreground">Curso:</strong>{' '}
                  {course?.name ?? '—'}
                </p>
                <p>
                  <strong className="text-foreground">Profesor:</strong>{' '}
                  {teacher ? personFullName(teacher) : 'Sin asignar'}
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
            label="Reunión"
            htmlFor="class-meeting-platform"
            error={errors.meetingPlatform}
            hint="Meet y Zoom son excluyentes. Zoom también crea un evento en Google Calendar si está configurado."
          >
            <Select
              id="class-meeting-platform"
              value={form.meetingPlatform}
              onChange={(event) =>
                update(
                  'meetingPlatform',
                  event.target.value as MeetingPlatform,
                )
              }
              aria-invalid={Boolean(errors.meetingPlatform)}
            >
              <option value="none">Sin reunión automática</option>
              <option value="meet" disabled={!meetConfigured}>
                Google Meet
                {!meetConfigured ? ' (no configurado)' : ''}
              </option>
              <option value="zoom" disabled={!zoomConfigured}>
                Zoom
                {!zoomConfigured ? ' (no configurado)' : ''}
              </option>
              <option value="manual">Enlace manual (https://)</option>
            </Select>
          </Field>

          {form.meetingPlatform === 'manual' && (
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
          )}

          <Field
            label="Descripción de la reunión"
            htmlFor="class-meet-description"
            hint="Aparece en Zoom (agenda) y/o en el evento de Google Calendar."
          >
            <Textarea
              id="class-meet-description"
              rows={4}
              maxLength={4000}
              placeholder={
                'Ej.\nMaterial: https://...\nNotas para el alumno…'
              }
              value={form.meetingDescription}
              onChange={(event) =>
                update('meetingDescription', event.target.value)
              }
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
              <p className="sm:col-span-2">
                <strong className="text-foreground">Reunión:</strong>{' '}
                {platformLabel}
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
