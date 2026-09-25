'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, ChevronRight, GraduationCap, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { Badge, ThemeToggle } from '@/components/ui/primitives'

const sections = [
  { title: 'Academia', links: [{ label: 'Inicio', href: '/dashboard', icon: LayoutDashboard }, { label: 'Estudiantes', href: '/dashboard/students', icon: Users }, { label: 'Profesores', href: '/dashboard/teachers', icon: UserRound }, { label: 'Asignaciones', href: '/dashboard/assignments', icon: GraduationCap }, { label: 'Cursos', href: '/dashboard/courses', icon: BookOpen }, { label: 'Grupos', href: '/dashboard/groups', icon: Users }] },
  { title: 'Clases', links: [{ label: 'Clases', href: '/dashboard/classes', icon: CalendarDays }, { label: 'Calendario', href: '/dashboard/calendar', icon: CalendarDays }] },
  { title: 'Administración', links: [{ label: 'Permisos', href: '/dashboard/permissions', icon: ShieldCheck }, { label: 'Administrativos', href: '/dashboard/administratives', icon: Users }, { label: 'Configuración', href: '/dashboard/settings', icon: Settings }] },
]

function Sidebar({ close }: { close?: () => void }) {
  return <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface px-4 py-5"><div className="flex items-center justify-between"><Link href="/" onClick={close} className="flex items-center gap-3 px-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap /></span><span className="font-semibold tracking-tight">Academia<span className="text-primary">.</span></span></Link>{close && <button onClick={close} className="rounded-lg p-2 text-muted-foreground md:hidden" aria-label="Cerrar navegación"><X /></button>}</div><nav className="mt-8 flex flex-1 flex-col gap-7" aria-label="Navegación principal">{sections.map((section) => <div key={section.title}><p className="px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{section.title}</p><div className="mt-2 flex flex-col gap-1">{section.links.map(({ label, href, icon: Icon }) => <a key={href} href={href} onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"><Icon className="size-4" />{label}</a>)}</div></div>)}</nav><div className="rounded-2xl bg-primary/8 p-4"><p className="text-sm font-medium">¿Necesitás ayuda?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Estamos para acompañarte en cada paso.</p><Link href="/#contacto" onClick={close} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Contactar <ChevronRight className="size-3.5" /></Link></div></aside>
}

export function DashboardShell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [isDevMode, setIsDevMode] = useState(false)

  useEffect(() => {
    setIsDevMode(Boolean(window.localStorage.getItem('academy-dev-session')))
  }, [])

  function exitDevMode() {
    window.localStorage.removeItem('academy-dev-session')
    window.location.href = '/login'
  }

  return <div className="min-h-screen bg-background text-foreground"><div className="fixed inset-0 z-50 flex md:hidden" hidden={!open}><button className="flex-1 bg-foreground/20" aria-label="Cerrar navegación" onClick={() => setOpen(false)} /><Sidebar close={() => setOpen(false)} /></div><div className="flex min-h-screen"><div className="hidden md:block"><Sidebar /></div><div className="min-w-0 flex-1"><header className="flex h-[76px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur lg:px-8"><div className="flex items-center gap-3"><button className="flex size-10 items-center justify-center rounded-xl border border-border md:hidden" aria-label="Abrir navegación" onClick={() => setOpen(true)}><Menu /></button><div><p className="text-sm text-muted-foreground">Panel de gestión</p><h1 className="text-lg font-semibold tracking-tight">{title}</h1></div></div><div className="flex items-center gap-3"><ThemeToggle />{isDevMode && <Badge tone="warning" className="hidden sm:inline-flex">DEV MODE</Badge>}<div className="hidden text-right sm:block"><p className="text-sm font-medium">{isDevMode ? 'Omegon' : 'Tu cuenta'}</p><p className="text-xs text-muted-foreground">{isDevMode ? 'Sesión de desarrollo' : 'Sesión activa'}</p></div>{isDevMode ? <button type="button" onClick={exitDevMode} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground" aria-label="Salir del modo desarrollo"><LogOut className="size-4" /> <span className="hidden lg:inline">Salir</span></button> : <span className="flex size-10 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">AC</span>}</div></header><main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">{children}</main></div></div></div>
}

export function PageHeader({ title, description, action, eyebrow }: { title: string; description: string; action?: ReactNode; eyebrow?: string }) {
  return <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div>{eyebrow && <p className="text-sm font-semibold text-primary">{eyebrow}</p>}<h2 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</div>
}
