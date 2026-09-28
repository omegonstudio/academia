'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  Course,
  GenerateClassSessionsResponse,
  Group,
  ScheduleOption,
  Teacher,
} from '@academia/shared'
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
  generateClassSessionsBrowser,
  personFullName,
} from '@/lib/api-browser'
import { validateGenerateDateRange } from '@/lib/class-session-generate'

type Form = { groupId: string; from: string; to: string }

const initial: Form = { groupId: '', from: '', to: '' }

export function ClassGenerationDialog({
  groups,
  courses,
  teachers,
  scheduleOptions,
  onClose,
  onCreated,
}: {
  groups: Group[]
  courses: Course[]
  teachers: Teacher[]
  scheduleOptions: ScheduleOption[]
  onClose: () => void
  onCreated: (result: GenerateClassSessionsResponse) => void
}) {
  const [form, setForm] = useState<Form>(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const eligibleGroups = useMemo(
    () =>
      groups.filter(
        (group) => group.isActive && Boolean(group.scheduleOptionId),
      ),
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
  const scheduleById = useMemo(
    () => new Map(scheduleOptions.map((option) => [option.id, option])),
    [scheduleOptions],
  )

  const group = eligibleGroups.find((item) => item.id === form.groupId)
  const course = group ? courseById.get(group.courseId) : undefined
  const teacher = group?.teacherId
    ? teacherById.get(group.teacherId)
    : undefined
  const schedule = group?.scheduleOptionId
    ? scheduleById.get(group.scheduleOptionId)
    : undefined

  const rangePreview = validateGenerateDateRange(form.from, form.to)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')

    if (!form.groupId) {
      setError('Seleccioná un grupo.')
      return
    }
    const range = validateGenerateDateRange(form.from, form.to)
    if (!range.ok) {
      setError(range.message)
      return
    }

    setBusy(true)
    const result = await generateClassSessionsBrowser(form.groupId, {
      from: range.from,
      to: range.to,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onCreated(result.data)
  }

  return (
    <div
      className="fixed inset-0 z-50 isolate flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-title"
    >
      <div className="max-h-[calc(100vh-1.5rem)] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="generation-title" className="text-xl font-semibold">
              Generar clases
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Creá sesiones semanales según la franja horaria del grupo.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
          >
            <X />
          </Button>
        </div>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
          {error && <Alert>{error}</Alert>}
          <Field label="Grupo" htmlFor="generation-group">
            <Select
              id="generation-group"
              value={form.groupId}
              onChange={(event) => update('groupId', event.target.value)}
            >
              <option value="">Seleccioná un grupo</option>
              {eligibleGroups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          {eligibleGroups.length === 0 && (
            <Alert tone="info">
              No hay grupos activos con franja horaria. Asigná un horario en el
              detalle del grupo.
            </Alert>
          )}
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
                <p className="text-xs text-muted-foreground">Franja</p>
                <p className="mt-1 text-sm font-semibold">
                  {schedule?.label ?? '—'}
                </p>
              </div>
            </Card>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fecha desde" htmlFor="generation-from">
              <Input
                id="generation-from"
                type="date"
                value={form.from}
                onChange={(event) => update('from', event.target.value)}
              />
            </Field>
            <Field label="Fecha hasta" htmlFor="generation-to">
              <Input
                id="generation-to"
                type="date"
                value={form.to}
                onChange={(event) => update('to', event.target.value)}
              />
            </Field>
          </div>
          <Card className="border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-semibold">Resumen de generación</p>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                <strong className="text-foreground">Grupo:</strong>{' '}
                {group?.name ?? '—'}
              </p>
              <p>
                <strong className="text-foreground">Rango:</strong>{' '}
                {form.from || '—'} — {form.to || '—'}
              </p>
              <p>
                <strong className="text-foreground">Franja:</strong>{' '}
                {schedule?.label ?? '—'}
              </p>
              <p>
                <strong className="text-foreground">Días del rango:</strong>{' '}
                {rangePreview.ok ? rangePreview.dayCount : '—'}
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Solo se crean los días que coinciden con la franja del grupo. Las
              sesiones existentes o en conflicto se omiten.
            </p>
          </Card>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || eligibleGroups.length === 0}>
              {busy ? 'Generando…' : 'Generar clases'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
