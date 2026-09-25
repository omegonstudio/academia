import Link from 'next/link'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Users,
} from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'

const quickLinks = [
  {
    label: 'Ver estudiantes',
    href: '/dashboard/students',
    icon: Users,
    text: 'Consultá perfiles y niveles.',
  },
  {
    label: 'Revisar clases',
    href: '/dashboard/classes',
    icon: CalendarDays,
    text: 'Organizá las próximas clases.',
  },
  {
    label: 'Explorar cursos',
    href: '/dashboard/courses',
    icon: BookOpen,
    text: 'Gestioná la propuesta académica.',
  },
  {
    label: 'Abrir calendario',
    href: '/dashboard/calendar',
    icon: CalendarDays,
    text: 'Visualizá la agenda mensual.',
  },
] as const

export default function DashboardPage() {
  return (
    <DashboardShell title="Inicio">
      <PageHeader
        eyebrow="Academia de Español — Omegon"
        title="Tu espacio de gestión"
        description="Accedé a la información de estudiantes, clases y cursos desde un mismo lugar."
      />
      <section className="rounded-[1.75rem] bg-primary px-6 py-7 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(82,43,120,.5)] sm:px-8 sm:py-9">
        <p className="text-sm text-primary-foreground/70">
          Academia de Español — Omegon
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Tu espacio de gestión
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/80">
          Accedé a la información de estudiantes, clases y cursos desde un mismo
          lugar.
        </p>
      </section>
      <section className="mt-8" aria-labelledby="accesos-rapidos">
        <p className="text-sm font-semibold text-primary">Accesos rápidos</p>
        <h2
          id="accesos-rapidos"
          className="mt-1 text-2xl font-semibold tracking-tight"
        >
          ¿Qué querés hacer?
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map(({ label, href, icon: Icon, text }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-semibold">{label}</h3>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                {text}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Abrir{' '}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">Próximas clases</h2>
            <p className="text-sm text-muted-foreground">
              La agenda aparecerá cuando haya clases programadas.
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-dashed border-border px-5 py-8 text-center">
          <p className="text-sm font-medium">
            Todavía no hay clases para mostrar.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando se conecte la agenda real, vas a verla acá.
          </p>
          <Link
            href="/dashboard/classes"
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
          >
            Ir a clases
          </Link>
        </div>
      </section>
    </DashboardShell>
  )
}
