import Link from 'next/link'
import { ArrowLeft, BookOpen, Users } from 'lucide-react'
import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { Badge, Button } from '@/components/ui/primitives'
import { demoCourses } from '@/lib/academy-data'

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const course = demoCourses.find((item) => item.id === id) ?? demoCourses[0]
  if (!course) notFound()
  return (
    <DashboardShell title="Detalle de curso">
      <Link href="/dashboard/courses" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />Volver a cursos
      </Link>
      <div className="mt-8 flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen /></span>
              <Badge tone="success">Activo</Badge>
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight">{course.name}</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{course.description}</p>
          </div>
          <Button>Editar curso</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-muted-foreground">Nivel</p>
            <p className="mt-2 text-2xl font-semibold">{course.level}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-muted-foreground">Estudiantes</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold"><Users className="size-5 text-primary" />{course.studentCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="mt-2 text-2xl font-semibold">Activo</p>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
