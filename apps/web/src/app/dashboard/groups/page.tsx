'use client'

import { useState } from 'react'
import { CalendarDays, Plus, Users, X } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui/primitives'
import { demoCourses, demoGroups, demoTeachers, type Group } from '@/lib/academy-data'

const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const courseDetails: Record<string, { modality: string; duration: string }> = {
  A1: { modality: 'Grupal · Online', duration: '8 semanas' },
  B1: { modality: 'Grupal · Híbrida', duration: '10 semanas' },
  C1: { modality: 'Grupal · Presencial', duration: '12 semanas' },
}

type GroupForm = { name: string; courseId: string; teacherId: string; day: string; startTime: string; endTime: string }
const emptyForm: GroupForm = { name: '', courseId: '', teacherId: '', day: 'Lunes', startTime: '18:00', endTime: '20:00' }

function NewGroupDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (group: Group) => void }) {
  const [form, setForm] = useState<GroupForm>(emptyForm)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedCourse = demoCourses.find((course) => course.id === form.courseId)
  const selectedTeacher = demoTeachers.find((teacher) => teacher.id === form.teacherId)
  const details = selectedCourse ? courseDetails[selectedCourse.level] : undefined
  const schedule = `${form.day} ${form.startTime}`

  function update(key: keyof GroupForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError('')
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name.trim() || !form.courseId) {
      setError('Completá el nombre del grupo y seleccioná un curso.')
      return
    }
    setIsSubmitting(true)
    window.setTimeout(() => {
      const group: Group = {
        id: `grp-${Date.now()}`,
        name: form.name.trim(),
        courseId: form.courseId,
        courseName: selectedCourse?.name ?? '',
        teacherId: selectedTeacher?.id ?? '',
        teacherName: selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : 'Sin asignar',
        studentCount: 0,
        schedule,
        isActive: true,
      }
      demoGroups.push(group)
      onCreated(group)
      onClose()
    }, 500)
  }

  return <div className="fixed inset-0 z-50 isolate flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="group-dialog-title">
    <div className="max-h-[calc(100vh-1.5rem)] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><h2 id="group-dialog-title" className="text-xl font-semibold">Nuevo grupo</h2><p className="mt-1 text-sm text-muted-foreground">Configurá el nuevo grupo de la academia.</p></div><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar"><X /></Button></div>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        {error && <Alert>{error}</Alert>}
        <Field label="Nombre del grupo" htmlFor="group-name" error={error && !form.name.trim() ? 'El nombre es obligatorio.' : undefined}><Input id="group-name" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ej. Conversación B1 — Grupo A" aria-required="true" /></Field>
        <Field label="Curso" htmlFor="group-course" error={error && !form.courseId ? 'Seleccioná un curso.' : undefined}><Select id="group-course" value={form.courseId} onChange={(event) => update('courseId', event.target.value)} aria-required="true"><option value="">Seleccioná un curso</option>{demoCourses.filter((course) => course.isActive).map((course) => <option key={course.id} value={course.id}>{course.name} · {course.level}</option>)}</Select></Field>
        {selectedCourse && details && <Card className="grid gap-3 bg-primary/5 p-4 text-sm sm:grid-cols-3"><div><span className="block text-xs text-muted-foreground">Tipo y modalidad</span><strong>{details.modality}</strong></div><div><span className="block text-xs text-muted-foreground">Duración</span><strong>{details.duration}</strong></div><div><span className="block text-xs text-muted-foreground">Nivel</span><strong>{selectedCourse.level}</strong></div></Card>}
        <Field label="Profesor" htmlFor="group-teacher" hint="Opcional"><Select id="group-teacher" value={form.teacherId} onChange={(event) => update('teacherId', event.target.value)}><option value="">Sin asignar</option>{demoTeachers.filter((teacher) => teacher.isActive).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}</Select></Field>
        <fieldset className="flex flex-col gap-3"><legend className="text-sm font-medium">Horario</legend><div className="grid gap-4 sm:grid-cols-3"><Field label="Día" htmlFor="group-day"><Select id="group-day" value={form.day} onChange={(event) => update('day', event.target.value)}>{weekdays.map((day) => <option key={day}>{day}</option>)}</Select></Field><Field label="Hora de inicio" htmlFor="group-start"><Input id="group-start" type="time" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} /></Field><Field label="Hora de finalización" htmlFor="group-end"><Input id="group-end" type="time" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} /></Field></div></fieldset>
        <Field label="Capacidad" htmlFor="group-capacity" hint="La capacidad máxima no se puede modificar."><Input id="group-capacity" value="15 estudiantes" disabled /></Field>
        <Card className="bg-surface-muted p-4"><p className="text-sm font-semibold">Resumen</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Grupo</dt><dd className="font-medium">{form.name || 'Sin definir'}</dd></div><div><dt className="text-muted-foreground">Curso</dt><dd className="font-medium">{selectedCourse?.name || 'Sin seleccionar'}</dd></div><div><dt className="text-muted-foreground">Profesor</dt><dd className="font-medium">{selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : 'Sin asignar'}</dd></div><div><dt className="text-muted-foreground">Horario</dt><dd className="font-medium">{schedule} · hasta {form.endTime}</dd></div><div className="sm:col-span-2"><dt className="text-muted-foreground">Capacidad</dt><dd className="font-medium">15 estudiantes máximo</dd></div></dl></Card>
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear grupo'}</Button></div>
      </form>
    </div>
  </div>
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>(demoGroups)
  const [isOpen, setIsOpen] = useState(false)
  const [success, setSuccess] = useState(false)

  function handleCreated(_group: Group) {
    setGroups([...demoGroups])
    setSuccess(true)
    window.setTimeout(() => setSuccess(false), 3500)
  }

  return <DashboardShell title="Grupos"><PageHeader title="Grupos" description="Coordiná horarios, cursos y equipos de estudiantes." action={<Button onClick={() => { setSuccess(false); setIsOpen(true) }}><Plus data-icon="inline-start" />Nuevo grupo</Button>} />{success && <div className="mb-5"><Alert tone="success">Grupo creado correctamente.</Alert></div>}<div className="grid gap-4 lg:grid-cols-2">{groups.map((group) => <a href={`/dashboard/groups/${group.id}`} key={group.id} className="group rounded-2xl border border-border bg-surface p-5 transition hover:border-primary/40 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-primary">{group.courseName}</p><h3 className="mt-1 text-lg font-semibold group-hover:text-primary">{group.name}</h3></div><Badge tone={group.isActive ? 'success' : 'neutral'}>{group.isActive ? 'Activo' : 'Inactivo'}</Badge></div><div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:grid-cols-2"><span className="flex items-center gap-2"><Users className="size-4 text-primary" />{group.studentCount} estudiantes</span><span className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" />{group.schedule}</span></div><p className="mt-4 text-sm">Profesor: <span className="font-medium">{group.teacherName}</span></p></a>)}</div>{isOpen && <NewGroupDialog onClose={() => setIsOpen(false)} onCreated={handleCreated} />}</DashboardShell>
}
