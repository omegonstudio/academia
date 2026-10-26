'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, Sparkles, X } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/primitives'
import { publicCta, publicNavLinks } from '@/lib/public-nav'
import { cn } from '@/lib/utils'

export function PublicSiteHeader({
  activePath,
}: {
  activePath?: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 lg:px-8">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-3"
        aria-label="Academia, inicio"
        onClick={() => setMenuOpen(false)}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          Academia<span className="text-primary">.</span>
        </span>
      </Link>

      <nav
        className={cn(
          menuOpen
            ? 'absolute left-4 right-4 top-20 flex'
            : 'hidden',
          'flex-col gap-1 rounded-2xl border border-border bg-surface-elevated p-2 shadow-lg md:static md:flex md:flex-row md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none lg:gap-2',
        )}
        aria-label="Navegación principal"
      >
        {publicNavLinks.map((link) => {
          const active = activePath === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                'rounded-lg px-2.5 py-2 text-sm transition hover:bg-surface-muted hover:text-foreground lg:px-3',
                active
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </Link>
          )
        })}
        <Link
          href={publicCta.href}
          onClick={() => setMenuOpen(false)}
          className="mt-1 inline-flex items-center justify-center rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 md:hidden"
        >
          {publicCta.label}
        </Link>
        <div className="mt-2 flex items-center justify-between border-t border-border px-3 py-3 md:hidden">
          <span className="text-sm font-medium">Tema</span>
          <ThemeToggle />
        </div>
      </nav>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex">
          <ThemeToggle />
        </div>
        <Link
          href={publicCta.href}
          className="hidden rounded-xl bg-accent px-3.5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 lg:inline-flex"
        >
          {publicCta.label}
        </Link>
        <Link
          href="/login"
          className="hidden rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-medium transition hover:bg-surface-muted sm:inline-flex"
        >
          Ingresar
        </Link>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {menuOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>
    </header>
  )
}
