'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui/primitives'
import { demoClasses, demoGroups, type AcademyClass } from '@/lib/academy-data'

type ClassForm = { groupId: string; date: string; startTime: string; endTime: string; meetingUrl: string }

const initialForm: ClassForm = { groupId: '', date: '', startTime: '', endTime: '', meetingUrl: '' }

function durationBetween(start: string, end: string) {
  if (!start || !end) return 0
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number)
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number)
  return (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
}

function formatSummaryDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`))
}

export function ClassFormDialog({ onClose, onCreated, initialDate }: { onClose: () => void; onCreated: (item: AcademyClass) => void; initialDate?: string }) {
  const [form, setForm] = useState<ClassForm>(() => ({ ...initialForm, date: initialDate ?? '' }))
  const [errors, setErrors] = useState<Partial<Record<keyof ClassForm, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const group = demoGroups.find((item) => item.id === form.groupId)
  const duration = useMemo(() => durationBetween(form.startTime, form.endTime), [form.startTime, form.endTime])

  function update<K extends keyof ClassForm>(key: K, value: ClassForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function validate() {
    const next: typeof errors = {}
    if (!form.groupId) next.groupId = 'Grupo obligatorio'
    if (!form.date) next.date = 'Fecha obligatoria'
    if (!form.startTime) next.startTime = 'Hora de inicio obligatoria'
    if (!form.endTime) next.endTime = 'Hora de finalización obligatoria'
    if (form.startTime && form.endTime && duration <= 0) next.endTime = 'La hora de finalización debe ser posterior al inicio'
    if (form.meetingUrl && !/^https:\/\//i.test(form.meetingUrl)) next.meetingUrl = 'La URL debe comenzar con https://'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (isSubmitting || !validate() || !group) return
    setIsSubmitting(true)
    window.setTimeout(() => {
      const startAt = `${form.date}T${form.startTime}:00`
      const item: AcademyClass = { id: `cls-${Date.now()}`, groupId: group.id, groupName: group.name, courseId: group.courseId, courseName: group.courseName, teacherId: group.teacherId, teacherName: group.teacherName, startAt, endAt: `${form.date}T${form.endTime}:00`, durationMinutes: duration, modality: 'Grupal', meetingUrl: form.meetingUrl, isActive: true, students: [], attendance: `0 de ${group.studentCount} presentes`, notes: '', materials: [], status: 'SCHEDULED' }
      demoClasses.unshift(item)
      onCreated(item)
    }, 500)
  }

  return <div className="fixed inset-0 z-50 isolate flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="class-dialog-title">
    <div className="max-h-[calc(100vh-1.5rem)] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><h2 id="class-dialog-title" className="text-xl font-semibold">Nueva clase</h2><p className="mt-1 text-sm text-muted-foreground">Programá una nueva clase para un grupo.</p></div><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar"><X /></Button></div>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        {Object.keys(errors).length > 0 && <Alert>Revisá los campos indicados para continuar.</Alert>}
        <Field label="Grupo" htmlFor="class-group" error={errors.groupId}><Select id="class-group" value={form.groupId} onChange={(event) => update('groupId', event.target.value)} aria-invalid={Boolean(errors.groupId)}><option value="">Seleccioná un grupo</option>{demoGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        {group && <Card className="grid gap-3 bg-surface-muted/45 p-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Curso</p><p className="mt-1 text-sm font-semibold">{group.courseName}</p></div><div><p className="text-xs text-muted-foreground">Profesor</p><p className="mt-1 text-sm font-semibold">{group.teacherName}</p></div><div><p className="text-xs text-muted-foreground">Modalidad</p><p className="mt-1 text-sm font-semibold">Grupal · {group.studentCount} estudiantes</p></div><div><p className="text-xs text-muted-foreground">Horario habitual</p><p className="mt-1 text-sm font-semibold">{group.schedule}</p></div></Card>}
        <div className="grid gap-5 sm:grid-cols-3"><Field label="Fecha" htmlFor="class-date" error={errors.date}><Input id="class-date" type="date" value={form.date} onChange={(event) => update('date', event.target.value)} aria-invalid={Boolean(errors.date)} /></Field><Field label="Hora de inicio" htmlFor="class-start" error={errors.startTime}><Input id="class-start" type="time" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} aria-invalid={Boolean(errors.startTime)} /></Field><Field label="Hora de finalización" htmlFor="class-end" error={errors.endTime}><Input id="class-end" type="time" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} aria-invalid={Boolean(errors.endTime)} /></Field></div>
        {duration > 0 && <p className="-mt-2 text-sm font-medium text-primary">Duración: {duration} min</p>}
        <Field label="Enlace de videollamada" htmlFor="class-meeting" error={errors.meetingUrl} hint="Opcional"><Input id="class-meeting" type="url" placeholder="https://..." value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} aria-invalid={Boolean(errors.meetingUrl)} /></Field>
        <Card className="border-primary/20 bg-primary/5 p-5"><p className="text-sm font-semibold">Resumen</p><div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p><strong className="text-foreground">Curso:</strong> {group?.courseName ?? '—'}</p><p><strong className="text-foreground">Grupo:</strong> {group?.name ?? '—'}</p><p><strong className="text-foreground">Profesor:</strong> {group?.teacherName ?? '—'}</p><p><strong className="text-foreground">Fecha:</strong> {formatSummaryDate(form.date)}</p><p><strong className="text-foreground">Horario:</strong> {form.startTime || '—'} — {form.endTime || '—'}</p><p><strong className="text-foreground">Duración:</strong> {duration > 0 ? `${duration} minutos` : '—'}</p><p><strong className="text-foreground">Estudiantes:</strong> {group ? group.studentCount : '—'}</p></div></Card>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear clase'}</Button></div>
      </form>
    </div>
  </div>
}
