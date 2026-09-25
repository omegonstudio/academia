'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  BookOpen,
  LogOut,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  UserRound,
} from 'lucide-react'
import { Badge, ThemeToggle } from '@/components/ui/primitives'

const navigation = [
  { label: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Estudiantes', href: '/dashboard/students', icon: Users },
  { label: 'Profesores', href: '/dashboard/teachers', icon: UserRound },
  { label: 'Asignaciones', href: '/dashboard/assignments', icon: GraduationCap },
  { label: 'Cursos', href: '/dashboard/courses', icon: BookOpen },
  { label: 'Grupos', href: '/dashboard/groups', icon: Users },
]

const classLinks = [
  { label: 'Clases', href: '/dashboard/classes', icon: CalendarDays },
  { label: 'Calendario', href: '/dashboard/calendar', icon: CalendarDays },
]

const adminLinks = [
  { label: 'Permisos', href: '/dashboard/permissions', icon: ShieldCheck },
  { label: 'Administrativos', href: '/dashboard/administratives', icon: Users },
  { label: 'Configuración', href: '/dashboard/settings', icon: Settings },
]

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface px-4 py-5">
      <Link href="/" className="flex items-center gap-3 px-3" onClick={onNavigate}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><GraduationCap className="h-5 w-5" /></span>
        <span className="font-semibold tracking-tight">Academia<span className="text-primary">.</span></span>
      </Link>
      <nav className="mt-8 flex-1 space-y-7" aria-label="Navegación principal">
        <NavSection title="Academia" links={navigation} onNavigate={onNavigate} />
        <NavSection title="Clases" links={classLinks} onNavigate={onNavigate} />
        <NavSection title="Administración" links={adminLinks} onNavigate={onNavigate} />
      </nav>
      <div className="rounded-2xl bg-primary/8 p-4">
        <p className="text-sm font-medium">¿Necesitás ayuda?</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Estamos para acompañarte en cada paso.</p>
        <a href="/#contacto" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={onNavigate}>Contactar <ChevronRight className="h-3.5 w-3.5" /></a>
      </div>
    </aside>
  )
}

function NavSection({ title, links, onNavigate }: { title: string; links: typeof navigation; onNavigate: () => void }) {
  return <div><p className="px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{title}</p><div className="mt-2 space-y-1">{links.map(({ label, href, icon: Icon }) => <a key={href} href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${href === '/dashboard' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'}`}><Icon className="h-4 w-4" />{label}</a>)}</div></div>
}

export default function DashboardPage() {
  const [open, setOpen] = useState(false)
  const [isDevMode, setIsDevMode] = useState(false)

  useEffect(() => {
    setIsDevMode(Boolean(window.localStorage.getItem('academy-dev-session')))
  }, [])

  function exitDevMode() {
    window.localStorage.removeItem('academy-dev-session')
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 z-50 flex md:hidden" data-open={open} hidden={!open}>
        <button className="flex-1 bg-foreground/20" aria-label="Cerrar navegación" onClick={() => setOpen(false)} />
        <div className="h-full"><Sidebar onNavigate={() => setOpen(false)} /></div>
      </div>
      <div className="flex min-h-screen">
        <div className="hidden md:block"><Sidebar onNavigate={() => undefined} /></div>
        <div className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur lg:px-8">
            <div className="flex items-center gap-3"><button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border md:hidden" aria-label="Abrir navegación" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button><div><p className="text-sm text-muted-foreground">Panel de gestión</p><h1 className="text-lg font-semibold tracking-tight">Inicio</h1></div></div>
            <div className="flex items-center gap-3"><ThemeToggle />{isDevMode && <Badge tone="warning" className="hidden sm:inline-flex">DEV MODE</Badge>}<div className="hidden text-right sm:block"><p className="text-sm font-medium">{isDevMode ? 'Omegon' : 'Tu cuenta'}</p><p className="text-xs text-muted-foreground">{isDevMode ? 'Sesión de desarrollo' : 'Sesión activa'}</p></div>{isDevMode ? <button type="button" onClick={exitDevMode} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground" aria-label="Salir del modo desarrollo"><LogOut className="size-4" /><span className="hidden lg:inline">Salir</span></button> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">AC</span>}</div>
          </header>
          <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
            <section className="rounded-[1.75rem] bg-primary px-6 py-7 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(82,43,120,.5)] sm:px-8 sm:py-9"><p className="text-sm text-primary-foreground/70">Academia de Español — Omegon</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Tu espacio de gestión</h2><p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/80">Accedé a la información de estudiantes, clases y cursos desde un mismo lugar.</p></section>
            <section className="mt-8"><div className="flex items-end justify-between"><div><p className="text-sm font-semibold text-primary">Accesos rápidos</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">¿Qué querés hacer?</h2></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Ver estudiantes',href:'/dashboard/students',icon:Users,text:'Consultá perfiles y niveles.'},{label:'Revisar clases',href:'/dashboard/classes',icon:CalendarDays,text:'Organizá las próximas clases.'},{label:'Explorar cursos',href:'/dashboard/courses',icon:BookOpen,text:'Gestioná la propuesta académica.'},{label:'Abrir calendario',href:'/dashboard/calendar',icon:CalendarDays,text:'Visualizá la agenda mensual.'}].map(({label,href,icon:Icon,text}) => <a key={href} href={href} className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-semibold">{label}</h3><p className="mt-2 text-sm leading-5 text-muted-foreground">{text}</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">Abrir <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></a>)}</div></section>
            <section className="mt-8 rounded-2xl border border-border bg-surface p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><CalendarDays className="h-5 w-5" /></span><div><h2 className="font-semibold">Próximas clases</h2><p className="text-sm text-muted-foreground">La agenda aparecerá cuando haya clases programadas.</p></div></div><div className="mt-6 rounded-xl border border-dashed border-border px-5 py-8 text-center"><p className="text-sm font-medium">Todavía no hay clases para mostrar.</p><p className="mt-1 text-sm text-muted-foreground">Cuando se conecte la agenda real, vas a verla acá.</p><a href="/dashboard/classes" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover">Ir a clases</a></div></section>
          </main>
        </div>
      </div>
    </div>
  )
}
