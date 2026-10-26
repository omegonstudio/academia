import type { Metadata } from 'next'
import {
  OfferCtaBand,
  OfferHero,
  PendingBlock,
  PublicOfferShell,
} from '@/components/public/offer-page'
import { blabla2go } from '@/lib/spanish2go-public-content'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Blabla2Go — Academia',
  description:
    'Blabla2Go es el club de encuentros mensuales para profes de español no nativos: hablar por los codos, WhatsApp privado y material incluido.',
  alternates: { canonical: `${site.url}/blabla2go` },
  openGraph: {
    title: 'Blabla2Go — Academia',
    description:
      'Club de debate y práctica para profes de español no nativos, según la propuesta original de Spanish2Go.',
    locale: site.locale,
    type: 'website',
  },
}

export default function Blabla2GoPage() {
  return (
    <PublicOfferShell activePath="/blabla2go">
      <OfferHero
        eyebrow="Club de encuentros"
        title={blabla2go.title}
        lead={blabla2go.lead}
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-12 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Qué es</h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
            {blabla2go.whatItIs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Qué no asumimos
          </h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
            {blabla2go.notAssumed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            {blabla2go.commercialNote}
          </p>
        </div>
      </section>

      <PendingBlock items={blabla2go.pending} />
      <OfferCtaBand
        title="¿Te interesa Blabla2Go?"
        text="Pedí la asesoría gratuita y contanos que querés información sobre la próxima edición. Sin plazas inventadas."
      />
    </PublicOfferShell>
  )
}
