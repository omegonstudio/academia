import type { Metadata } from 'next'
import {
  OfferCtaBand,
  OfferHero,
  PendingBlock,
  PublicOfferShell,
} from '@/components/public/offer-page'
import { educationalPills } from '@/lib/spanish2go-public-content'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Píldoras educativas — Academia',
  description:
    'Recursos cortos y ebooks gratuitos para profes de español no nativos, recuperados de la oferta de Spanish2Go.',
  alternates: { canonical: `${site.url}/pildoras-educativas` },
  openGraph: {
    title: 'Píldoras educativas — Academia',
    description:
      'Recursos cortos documentados de Spanish2Go para profesores de español no nativos.',
    locale: site.locale,
    type: 'website',
  },
}

export default function EducationalPillsPage() {
  return (
    <PublicOfferShell activePath="/pildoras-educativas">
      <OfferHero
        eyebrow="Recursos cortos"
        title={educationalPills.title}
        lead={educationalPills.namingNote}
      />

      <section className="mx-auto max-w-6xl px-5 pb-12 lg:px-8">
        <ul className="grid gap-5 md:grid-cols-3">
          {educationalPills.items.map((item) => (
            <li
              key={item.title}
              className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6"
            >
              <h2 className="text-lg font-semibold tracking-tight">
                {item.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                {item.text}
              </p>
              <p className="mt-5 text-xs text-muted-foreground">
                Fuente original:{' '}
                <a
                  href={item.source}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  spanish2go.online
                </a>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-2xl text-sm leading-6 text-muted-foreground">
          Academia no publica descargas inventadas: los archivos aún no están
          migrados. Tampoco se crea un segundo sistema de contenidos fuera del
          LMS de cursos online.
        </p>
      </section>

      <PendingBlock items={educationalPills.pending} />
      <OfferCtaBand />
    </PublicOfferShell>
  )
}
