import type { Metadata } from 'next'
import {
  OfferHero,
  PendingBlock,
  PublicOfferShell,
} from '@/components/public/offer-page'
import {
  advisoryMailto,
  freeAdvisory,
  spanish2goContact,
} from '@/lib/spanish2go-public-content'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Asesoría gratuita — Academia',
  description:
    'Solicitá una sesión gratuita de 30 minutos para trazar una hoja de ruta de tu práctica docente. Sin reservas automáticas inventadas.',
  alternates: { canonical: `${site.url}/asesoria` },
  openGraph: {
    title: 'Asesoría gratuita — Academia',
    description:
      'Sesión privada de 30 minutos documentada en la oferta Spanish2Go. Solicitud por correo.',
    locale: site.locale,
    type: 'website',
  },
}

export default function AdvisoryPage() {
  return (
    <PublicOfferShell activePath="/asesoria">
      <OfferHero
        eyebrow="Sin compromiso"
        title={freeAdvisory.title}
        lead={freeAdvisory.lead}
      />

      <section className="mx-auto max-w-6xl px-5 pb-12 lg:px-8">
        <ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
          {freeAdvisory.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">
            Cómo solicitarla
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Academia todavía no integra calendario de reservas. Escribí un
            correo para pedir la sesión: no hay turnos ficticios ni mensaje de
            “reserva confirmada” hasta que exista una integración real.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={advisoryMailto()}
              className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Escribir a {spanish2goContact.email}
            </a>
            <a
              href={`tel:${spanish2goContact.phoneTel}`}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-5 py-3.5 text-sm font-medium transition hover:bg-surface-muted"
            >
              Llamar {spanish2goContact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>

      <PendingBlock items={freeAdvisory.pending} />
    </PublicOfferShell>
  )
}
