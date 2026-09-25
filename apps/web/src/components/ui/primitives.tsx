'use client'

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useEffect, useState } from 'react'
import { Moon, Monitor, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Button({ className, variant = 'primary', size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'; size?: 'sm' | 'default' }) {
  return <button className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50', size === 'sm' && 'min-h-8 px-3 py-1 text-xs', variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary-hover', variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:opacity-90', variant === 'outline' && 'border border-border bg-surface text-foreground hover:bg-surface-muted', variant === 'ghost' && 'text-muted-foreground hover:bg-surface-muted hover:text-foreground', variant === 'danger' && 'bg-destructive text-white hover:opacity-90', className)} {...props} />
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('min-h-11 w-full rounded-xl border border-input bg-surface px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('min-h-11 w-full rounded-xl border border-input bg-surface px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('min-h-28 w-full resize-y rounded-xl border border-input bg-surface px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20', className)} {...props} />
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border border-border bg-surface', className)}>{children}</section>
}

export function Badge({ className, tone = 'neutral', children }: { className?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', tone === 'neutral' && 'bg-surface-muted text-muted-foreground', tone === 'success' && 'bg-success/12 text-success', tone === 'warning' && 'bg-secondary/12 text-secondary', tone === 'danger' && 'bg-destructive/12 text-destructive', tone === 'info' && 'bg-primary/12 text-primary', tone === 'accent' && 'bg-accent/12 text-accent', className)}>{children}</span>
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'success' | 'info'; children: ReactNode }) {
  return <div role="alert" className={cn('rounded-xl border px-4 py-3 text-sm', tone === 'danger' && 'border-destructive/25 bg-destructive/8 text-destructive', tone === 'success' && 'border-success/25 bg-success/8 text-success', tone === 'info' && 'border-primary/25 bg-primary/8 text-primary')}>{children}</div>
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-muted', className)} aria-hidden="true" />
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center"><p className="font-semibold">{title}</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
}

export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose }: { title: string; description: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 isolate flex items-center justify-center bg-foreground/50 p-5" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"><h2 id="confirm-title" className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button></div></div></div>
}

type ThemeMode = 'light' | 'system' | 'dark'

function readThemeMode(): ThemeMode {
  const saved = window.localStorage.getItem('academy-theme')
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

function applyTheme(mode: ThemeMode, prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches) {
  const root = document.documentElement
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  root.classList.toggle('light', !isDark)
  root.classList.toggle('dark', isDark)
}

export function ThemeGate({ children }: { children: ReactNode }) {
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = () => applyTheme(readThemeMode(), media.matches)
    syncTheme()
    setResolved(true)
    media.addEventListener('change', syncTheme)
    return () => media.removeEventListener('change', syncTheme)
  }, [])

  if (!resolved) {
    return <main className="min-h-screen bg-background p-6" aria-busy="true" aria-label="Cargando aplicación"><div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-6"><div className="h-12 w-48 rounded-2xl bg-surface-muted" /><div className="h-32 w-full rounded-3xl bg-surface-muted" /><div className="grid gap-4 md:grid-cols-3"><div className="h-28 rounded-2xl bg-surface-muted" /><div className="h-28 rounded-2xl bg-surface-muted" /><div className="h-28 rounded-2xl bg-surface-muted" /></div></div></main>
  }

  return children
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = () => applyTheme(readThemeMode(), media.matches)
    const initialMode = readThemeMode()
    setMode(initialMode)
    syncTheme()
    media.addEventListener('change', syncTheme)
    return () => media.removeEventListener('change', syncTheme)
  }, [])

  function changeMode(nextMode: ThemeMode) {
    setMode(nextMode)
    window.localStorage.setItem('academy-theme', nextMode)
    applyTheme(nextMode)
  }

  return <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1" aria-label="Selector de tema">
    {([['light', Sun, 'Tema claro'], ['system', Monitor, 'Tema del sistema'], ['dark', Moon, 'Tema oscuro']] as const).map(([value, Icon, label]) => <button key={value} type="button" onClick={() => changeMode(value)} aria-label={label} aria-pressed={mode === value} title={label} className={cn('flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring', mode === value && 'bg-primary/12 text-primary')}><Icon className="size-4" /></button>)}
  </div>
}

export function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="flex flex-col gap-2 text-sm font-medium">{label}{children}{hint && !error && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}{error && <span className="text-xs font-normal text-destructive">{error}</span>}</label>
}
