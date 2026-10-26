import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PublicSiteFooter } from '@/components/public/site-footer'
import { PublicSiteHeader } from '@/components/public/site-header'
import { ContentGap } from '@/components/public/content-gap'
import { publicCta } from '@/lib/public-nav'

export function PublicOfferShell({
  activePath,
  children,
}: {
  activePath: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <PublicSiteHeader activePath={activePath} />
      {children}
      <PublicSiteFooter />
    </main>
  )
}

export function OfferHero({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: string
  lead: string
}) {
  return (
    <header className="mx-auto max-w-6xl px-5 pb-10 pt-10 lg:px-8 lg:pt-16">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
        {lead}
      </p>
    </header>
  )
}

export function OfferCtaBand({
  title = '¿Querés una orientación personalizada?',
  text = 'Pedí la asesoría gratuita de 30 minutos. Sin simular reservas: te contactamos por correo.',
}: {
  title?: string
  text?: string
}) {
  return (
    <section className="bg-primary py-14 text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center lg:px-8">
        <div>
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/80">
            {text}
          </p>
        </div>
        <Link
          href={publicCta.href}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface px-5 py-3.5 text-sm font-medium text-foreground transition hover:bg-surface-muted"
        >
          {publicCta.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

export function PendingBlock({ items }: { items: readonly string[] }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 lg:px-8">
      <ContentGap items={items} />
    </div>
  )
}
