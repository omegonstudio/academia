import type { Metadata } from 'next'
import Link from 'next/link'
import {
  OfferCtaBand,
  OfferHero,
  PendingBlock,
  PublicOfferShell,
} from '@/components/public/offer-page'
import { mentorship } from '@/lib/spanish2go-public-content'
import { publicCta } from '@/lib/public-nav'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Mentorías individuales — Academia',
  description:
    'Mentorías y clases 1:1 para profes de español no nativos. Pedí una asesoría gratuita de 30 minutos para definir tu hoja de ruta.',
  alternates: { canonical: `${site.url}/mentorias` },
  openGraph: {
    title: 'Mentorías individuales — Academia',
    description:
      'Acompañamiento 1:1 documentado en la oferta Spanish2Go, con CTA a asesoría gratuita.',
    locale: site.locale,
    type: 'website',
  },
}

export default function MentorshipPage() {
  return (
    <PublicOfferShell activePath="/mentorias">
      <OfferHero
        eyebrow="Acompañamiento 1:1"
        title={mentorship.title}
        lead={mentorship.lead}
      />

      <section className="mx-auto max-w-6xl px-5 pb-12 lg:px-8">
        <ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
          {mentorship.points.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Sesión gratuita de orientación
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {mentorship.freeSession}
          </p>
          <Link
            href={publicCta.href}
            className="mt-5 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            {publicCta.label}
          </Link>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          No mostramos disponibilidad inventada ni confirmamos reservas
          automáticas: esa integración aún no está en Academia.
        </p>
      </section>

      <PendingBlock items={mentorship.pending} />
      <OfferCtaBand />
    </PublicOfferShell>
  )
}
