'use client'

import { LogOut, Moon, Monitor, Sun, UserRound } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { LogoutButton } from '@/components/logout-button'
import { useSessionUser } from '@/components/session-provider'
import { Card, ThemeToggle } from '@/components/ui/primitives'
import { sessionDisplayName, sessionInitials } from '@/lib/auth-shell'
import { roleLabel } from '@/lib/roles'

export default function SettingsPage() {
  const user = useSessionUser()
  const displayName = sessionDisplayName(user)
  const initials = sessionInitials(user)

  return (
    <DashboardShell title="Configuración">
      <PageHeader
        eyebrow="Administración / Configuración"
        title="Configuración"
        description="Consultá tu información y preferencias de la cuenta."
      />
      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initials}
            </span>
            <div>
              <h3 className="text-lg font-semibold">Tu cuenta</h3>
              <p className="text-sm text-muted-foreground">
                Información de sesión
              </p>
            </div>
          </div>
          <dl className="mt-8 grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre
              </dt>
              <dd className="mt-1 font-medium">{displayName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1 break-all font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rol
              </dt>
              <dd className="mt-1 font-medium">{roleLabel(user.role)}</dd>
            </div>
          </dl>
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Apariencia</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Elegí cómo querés ver la plataforma.
                </p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Sun className="size-4" />
              </span>
            </div>
            <div className="mt-5">
              <ThemeToggle />
            </div>
            <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
              <span>
                <Sun className="mr-1 inline size-3" />
                Claro
              </span>
              <span>
                <Monitor className="mr-1 inline size-3" />
                Sistema
              </span>
              <span>
                <Moon className="mr-1 inline size-3" />
                Oscuro
              </span>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-muted">
                <UserRound className="size-4" />
              </span>
              <div>
                <h3 className="font-semibold">Sesión</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tu sesión está activa.
                </p>
              </div>
            </div>
            <LogoutButton className="mt-5 inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-50">
              <LogOut className="size-4" />
              Cerrar sesión
            </LogoutButton>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
