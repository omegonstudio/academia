import Link from 'next/link'
import { ArrowLeft, CalendarDays, Users } from 'lucide-react'
import { notFound } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { Badge, Button } from '@/components/ui/primitives'
import { demoGroups } from '@/lib/academy-data'

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const group = demoGroups.find((item) => item.id === id) ?? demoGroups[0]
  if (!group) notFound()
  return (
    <DashboardShell title="Detalle de grupo">
      <Link href="/dashboard/groups" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />Volver a grupos
      </Link>
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row">
          <div>
            <div className="flex items-center gap-3">
              <Badge tone="success">Activo</Badge>
              <span className="text-sm text-primary">{group.courseName}</span>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">{group.name}</h2>
            <p className="mt-2 text-muted-foreground">Un espacio para acompañar el progreso del grupo.</p>
          </div>
          <Button>Editar grupo</Button>
        </div>
        <div className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Profesor</p>
            <p className="mt-2 font-medium">{group.teacherName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Horario</p>
            <p className="mt-2 flex items-center gap-2 font-medium"><CalendarDays className="size-4 text-primary" />{group.schedule}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estudiantes</p>
            <p className="mt-2 flex items-center gap-2 font-medium"><Users className="size-4 text-primary" />{group.studentCount}</p>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
