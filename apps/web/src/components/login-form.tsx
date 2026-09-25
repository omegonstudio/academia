'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ArrowRight, GraduationCap, Loader2, Moon, Sun } from 'lucide-react'
import { loginErrorMessage } from '@/lib/auth-shell'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dark, setDark] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        setError(loginErrorMessage(response.status))
        return
      }
      router.replace('/dashboard')
      router.refresh()
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      className={
        dark
          ? 'dark min-h-screen bg-background text-foreground'
          : 'min-h-screen bg-background text-foreground'
      }
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-semibold tracking-tight">
              Academia<span className="text-primary">.</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDark(!dark)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-surface-muted"
            aria-label={dark ? 'Usar modo claro' : 'Usar modo oscuro'}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>
        <div className="flex flex-1 items-center justify-center py-12">
          <section className="w-full max-w-md">
            <div className="mb-8 text-center">
              <p className="text-sm font-semibold text-primary">
                Bienvenido de nuevo
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Ingresá a tu espacio
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Gestioná clases, estudiantes y cursos desde la Academia.
              </p>
            </div>
            <form
              onSubmit={handleSubmit}
              className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-[0_24px_80px_-40px_rgba(82,43,120,.35)] sm:p-8"
            >
              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="text-sm font-medium">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Ingresar <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  ¿Problemas para ingresar? Contactá al equipo de Academia.
                </p>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
