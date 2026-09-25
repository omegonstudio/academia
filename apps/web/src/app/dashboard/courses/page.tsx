'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, Plus, X } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Alert, Badge, Button, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { demoCourses, type Course } from '@/lib/academy-data'

type CourseForm = {
  name: string
  description: string
  type: '' | 'Regular' | 'Formación docente'
  modality: '' | 'Individual · 60 min' | 'Individual · 90 min' | 'Grupal · 120 min'
  price: string
  currency: 'ARS' | 'USD'
}

const emptyForm: CourseForm = { name: '', description: '', type: '', modality: '', price: '', currency: 'ARS' }

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>(demoCourses)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState<CourseForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof CourseForm, string>>>({})

  function openDialog() {
    setForm(emptyForm)
    setErrors({})
    setSuccess(false)
    setIsOpen(true)
  }

  function closeDialog() {
    if (!isSubmitting) setIsOpen(false)
  }

  function updateField<K extends keyof CourseForm>(field: K, value: CourseForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validate() {
    const nextErrors: typeof errors = {}
    if (!form.name.trim()) nextErrors.name = 'Ingresá el nombre del curso.'
    if (!form.type) nextErrors.type = 'Seleccioná el tipo de curso.'
    if (!form.modality) nextErrors.modality = 'Seleccioná la modalidad.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !validate()) return
    setIsSubmitting(true)
    window.setTimeout(() => {
      const newCourse: Course = {
        id: `crs-${Date.now()}`,
        name: form.name.trim(),
        description: form.description.trim() || 'Nuevo curso de la academia',
        level: 'A1',
        isActive: true,
        studentCount: 0,
      }
      setCourses((current) => [newCourse, ...current])
      setIsSubmitting(false)
      setIsOpen(false)
      setSuccess(true)
    }, 450)
  }

  return <DashboardShell title="Cursos">
    <PageHeader title="Cursos" description="Organizá la propuesta académica de la academia." action={<Button onClick={openDialog}><Plus data-icon="inline-start" />Nuevo curso</Button>} />
    {success && <div className="mb-5"><Alert tone="success">Curso creado correctamente.</Alert></div>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => <a href={`/dashboard/courses/${course.id}`} key={course.id} className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"><div className="flex items-start justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen /></span><Badge tone={course.isActive ? 'success' : 'neutral'}>{course.isActive ? 'Activo' : 'Inactivo'}</Badge></div><h3 className="mt-5 text-lg font-semibold group-hover:text-primary">{course.name}</h3><p className="mt-2 text-sm text-muted-foreground">{course.description}</p><div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm"><span>Nivel {course.level}</span><span className="text-muted-foreground">{course.studentCount} estudiantes</span></div></a>)}
    </div>

    {isOpen && <div className="fixed inset-0 z-50 isolate flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="course-dialog-title">
      <div className="max-h-[min(860px,calc(100vh-1.5rem))] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 id="course-dialog-title" className="text-xl font-semibold">Nuevo curso</h2><p className="mt-1 text-sm text-muted-foreground">Completá la información básica del curso.</p></div><Button type="button" variant="ghost" size="sm" onClick={closeDialog} aria-label="Cerrar" disabled={isSubmitting}><X /></Button></div>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <Field label="Nombre" htmlFor="course-name" error={errors.name}><Input id="course-name" value={form.name} onChange={(event) => updateField('name', event.target.value)} aria-invalid={Boolean(errors.name)} placeholder="Ej. Español Conversación" /></Field>
          <Field label="Descripción" htmlFor="course-description"><Textarea id="course-description" value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Contá brevemente de qué trata el curso." /></Field>
          <div className="grid gap-5 sm:grid-cols-2"><Field label="Tipo de curso" htmlFor="course-type" error={errors.type}><Select id="course-type" value={form.type} onChange={(event) => updateField('type', event.target.value as CourseForm['type'])} aria-invalid={Boolean(errors.type)}><option value="">Seleccioná una opción</option><option value="Regular">Regular</option><option value="Formación docente">Formación docente</option></Select></Field><Field label="Modalidad" htmlFor="course-modality" error={errors.modality}><Select id="course-modality" value={form.modality} onChange={(event) => updateField('modality', event.target.value as CourseForm['modality'])} aria-invalid={Boolean(errors.modality)}><option value="">Seleccioná una opción</option><option value="Individual · 60 min">Individual · 60 min</option><option value="Individual · 90 min">Individual · 90 min</option><option value="Grupal · 120 min">Grupal · 120 min</option></Select></Field></div>
          {form.modality && <div className="rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-primary">Duración: <strong>{form.modality.split(' · ')[1]}</strong></div>}
          <div className="grid gap-5 sm:grid-cols-[1fr_160px]"><Field label="Precio" htmlFor="course-price" hint="Opcional"><Input id="course-price" inputMode="decimal" value={form.price} onChange={(event) => updateField('price', event.target.value)} placeholder="Sin cargo" /></Field><Field label="Moneda" htmlFor="course-currency"><Select id="course-currency" value={form.currency} onChange={(event) => updateField('currency', event.target.value as CourseForm['currency'])}><option value="ARS">ARS</option><option value="USD">USD</option></Select></Field></div>
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear curso'}</Button></div>
        </form>
      </div>
    </div>}
  </DashboardShell>
}
