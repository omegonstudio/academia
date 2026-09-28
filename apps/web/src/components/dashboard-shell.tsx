'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'
import { useSessionUser } from '@/components/session-provider'
import { ThemeToggle } from '@/components/ui/primitives'
import {
  dashboardNavSections,
  sessionDisplayName,
  sessionInitials,
  type ShellNavLink,
  type ShellNavSection,
} from '@/lib/auth-shell'
import { roleLabel } from '@/lib/roles'

const MEMBERSHIP_NAV: ShellNavLink = {
  label: 'Membresía',
  href: '/dashboard/membership',
}

/** Appends Membership for staff nav; Student Hub keeps its own links. */
function withMembershipNav(sections: ShellNavSection[]): ShellNavSection[] {
  return sections.map((section) => {
    if (section.title !== 'Academia') return section
    if (section.links.some((link) => link.href === MEMBERSHIP_NAV.href)) {
      return section
    }
    return {
      ...section,
      links: [...section.links, MEMBERSHIP_NAV],
    }
  })
}

const ICONS: Record<string, typeof LayoutDashboard> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/student': LayoutDashboard,
  '/dashboard/student/classes': CalendarDays,
  '/dashboard/student/materials': BookOpen,
  '/dashboard/student/attendance': GraduationCap,
  '/dashboard/student/finance': Wallet,
  '/dashboard/teacher': LayoutDashboard,
  '/dashboard/teacher/classes': CalendarDays,
  '/dashboard/teacher/students': Users,
  '/dashboard/teacher/materials': BookOpen,
  '/dashboard/teacher/attendance': GraduationCap,
  '/dashboard/teacher/earnings': Wallet,
  '/dashboard/students': Users,
  '/dashboard/teachers': UserRound,
  '/dashboard/assignments': GraduationCap,
  '/dashboard/courses': BookOpen,
  '/dashboard/groups': Users,
  '/dashboard/classes': CalendarDays,
  '/dashboard/calendar': CalendarDays,
  '/dashboard/membership': CreditCard,
  '/dashboard/finance': Wallet,
  '/dashboard/permissions': ShieldCheck,
  '/dashboard/administratives': Users,
  '/dashboard/settings': Settings,
}

function Sidebar({ close }: { close?: () => void }) {
  const user = useSessionUser()
  const sections = withMembershipNav(dashboardNavSections(user.role))

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface px-4 py-5">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-3 px-3"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap />
          </span>
          <span className="font-semibold tracking-tight">
            Academia<span className="text-primary">.</span>
          </span>
        </Link>
        {close ? (
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-muted-foreground md:hidden"
            aria-label="Cerrar navegación"
          >
            <X />
          </button>
        ) : null}
      </div>
      <nav
        className="mt-8 flex flex-1 flex-col gap-7"
        aria-label="Navegación del panel"
      >
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
              {section.title}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {section.links.map((link) => (
                <NavLink key={link.href} link={link} close={close} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="rounded-2xl bg-primary/8 p-4">
        <p className="text-sm font-medium">¿Necesitás ayuda?</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Estamos para acompañarte en cada paso.
        </p>
        <Link
          href="/#contacto"
          onClick={close}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Contactar <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </aside>
  )
}

function NavLink({
  link,
  close,
}: {
  link: ShellNavLink
  close?: () => void
}) {
  const Icon = ICONS[link.href] ?? LayoutDashboard
  return (
    <Link
      href={link.href}
      onClick={close}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
    >
      <Icon className="size-4" />
      {link.label}
    </Link>
  )
}

export function DashboardShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const user = useSessionUser()
  const [open, setOpen] = useState(false)
  const displayName = sessionDisplayName(user)
  const initials = sessionInitials(user)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 z-50 flex md:hidden" hidden={!open}>
        <button
          type="button"
          className="flex-1 bg-foreground/20"
          aria-label="Cerrar navegación"
          onClick={() => setOpen(false)}
        />
        <Sidebar close={() => setOpen(false)} />
      </div>
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-xl border border-border md:hidden"
                aria-label="Abrir navegación"
                onClick={() => setOpen(true)}
              >
                <Menu />
              </button>
              <div>
                <p className="text-sm text-muted-foreground">Panel de gestión</p>
                <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabel(user.role)}
                </p>
              </div>
              <span
                className="flex size-10 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                aria-hidden
              >
                {initials}
              </span>
              <LogoutButton className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground disabled:opacity-60">
                <LogOut className="size-4" />
                <span className="hidden lg:inline">Salir</span>
              </LogoutButton>
            </div>
          </header>
          <main
            id="contenido-panel"
            className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string
  description: string
  action?: ReactNode
  eyebrow?: string
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-sm font-semibold text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
