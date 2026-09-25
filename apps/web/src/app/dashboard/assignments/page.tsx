'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search, UserPlus, X } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Badge, Button } from '@/components/ui/primitives'
import { availabilityLabels, demoAssignments, demoStudents, demoTeachers, type Assignment } from '@/lib/academy-data'

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState(demoAssignments)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | Assignment['status']>('ALL')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const filtered = useMemo(() => assignments.filter((assignment) => {
    const matchesQuery = `${assignment.studentName} ${assignment.teacherName ?? ''}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (status === 'ALL' || assignment.status === status)
  }), [assignments, query, status])

  function saveAssignment() {
    const student = demoStudents.find((item) => item.id === selectedStudent)
    const teacher = demoTeachers.find((item) => item.id === selectedTeacher)
    if (!student || !teacher) return
    setAssignments((current) => current.map((item) => item.studentId === student.id ? { ...item, teacherId: teacher.id, teacherName: `${teacher.firstName} ${teacher.lastName}`, status: 'ASSIGNED' } : item))
    setSelectedStudent(''); setSelectedTeacher(''); setIsFormOpen(false)
  }

  return <DashboardShell title="Asignaciones"><PageHeader title="Asignaciones" description="Gestioná qué profesor acompaña a cada estudiante." action={<Button onClick={() => setIsFormOpen(true)}><UserPlus data-icon="inline-start" />Nueva asignación</Button>} />
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><label className="relative flex-1"><span className="sr-only">Buscar estudiante o profesor</span><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar estudiante o profesor" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm"><option value="ALL">Todos los estados</option><option value="ASSIGNED">Asignado</option><option value="UNASSIGNED">Sin asignar</option></select></div>
      <div className="mt-5 hidden grid-cols-[1.3fr_.6fr_1.2fr_.7fr_auto] gap-4 border-b border-border px-3 pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid"><span>Estudiante</span><span>Nivel</span><span>Profesor</span><span>Estado</span><span /></div>
      <div className="flex flex-col divide-y divide-border">{filtered.map((assignment) => <div key={assignment.id} className="grid gap-3 px-3 py-4 md:grid-cols-[1.3fr_.6fr_1.2fr_.7fr_auto] md:items-center md:gap-4"><div><p className="font-medium">{assignment.studentName}</p><p className="text-xs text-muted-foreground md:hidden">Nivel {assignment.studentLevel}</p></div><span className="hidden text-sm text-muted-foreground md:block">{assignment.studentLevel}</span><div className="text-sm">{assignment.teacherName ?? <span className="text-muted-foreground">Sin profesor asignado</span>}</div><Badge tone={assignment.status === 'ASSIGNED' ? 'success' : 'neutral'}>{assignment.status === 'ASSIGNED' ? 'Asignado' : 'Sin asignar'}</Badge><Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(assignment.studentId); setSelectedTeacher(assignment.teacherId ?? ''); setIsFormOpen(true) }}>{assignment.status === 'ASSIGNED' ? 'Cambiar' : 'Asignar'}</Button></div>)}</div>
    </section>
    {isFormOpen && <div className="fixed inset-0 z-50 isolate flex items-center justify-center bg-foreground/50 p-5"><div role="dialog" aria-modal="true" aria-labelledby="assignment-title" className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 id="assignment-title" className="text-xl font-semibold">{selectedStudent ? 'Cambiar profesor' : 'Nueva asignación'}</h2><p className="mt-1 text-sm text-muted-foreground">Elegí el estudiante y el profesor.</p></div><button aria-label="Cerrar" onClick={() => setIsFormOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted"><X className="size-4" /></button></div><div className="mt-6 flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">Estudiante<select value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 font-normal"><option value="">Seleccionar estudiante</option>{demoStudents.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.level}</option>)}</select></label><label className="flex flex-col gap-2 text-sm font-medium">Profesor<select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 font-normal"><option value="">Seleccionar profesor</option>{demoTeachers.filter((teacher) => teacher.isActive).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName} · {availabilityLabels[teacher.availability]}</option>)}</select></label></div><div className="mt-6 flex justify-end gap-3"><Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button><Button onClick={saveAssignment} disabled={!selectedStudent || !selectedTeacher}><Check data-icon="inline-start" />Confirmar asignación</Button></div></div></div>}
  </DashboardShell>
}

export { ChevronDown }

// Demo-only assignment flow; data is intentionally local until an API contract exists.
