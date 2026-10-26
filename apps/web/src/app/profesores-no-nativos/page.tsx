import type { Metadata } from 'next'
import Link from 'next/link'
import {
  OfferCtaBand,
  OfferHero,
  PendingBlock,
  PublicOfferShell,
} from '@/components/public/offer-page'
import { nonNativeTeachers } from '@/lib/spanish2go-public-content'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Profesores no nativos — Academia',
  description:
    'Formación y comunidad para profesores de español no nativos: un espacio seguro para mejorar tu español y tus clases.',
  alternates: { canonical: `${site.url}/profesores-no-nativos` },
  openGraph: {
    title: 'Profesores no nativos — Academia',
    description:
      'Formación y comunidad para profesores de español no nativos, con la propuesta de Spanish2Go.',
    locale: site.locale,
    type: 'website',
  },
}

export default function NonNativeTeachersPage() {
  return (
    <PublicOfferShell activePath="/profesores-no-nativos">
      <OfferHero
        eyebrow="Spanish2Go → Academia"
        title={nonNativeTeachers.title}
        lead={nonNativeTeachers.lead}
      />

      <section className="mx-auto max-w-6xl px-5 pb-12 lg:px-8">
        <h2 className="text-xl font-semibold tracking-tight">Pilares</h2>
        <ul className="mt-6 grid gap-5 md:grid-cols-3">
          {nonNativeTeachers.pillars.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border bg-surface py-14">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <h2 className="text-xl font-semibold tracking-tight">
            Situaciones que la propuesta original aborda
          </h2>
          <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
            {nonNativeTeachers.painPoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">
            También podés explorar{' '}
            <Link href="/cursos" className="font-medium text-primary hover:underline">
              cursos online
            </Link>
            ,{' '}
            <Link
              href="/mentorias"
              className="font-medium text-primary hover:underline"
            >
              mentorías
            </Link>{' '}
            y{' '}
            <Link
              href="/blabla2go"
              className="font-medium text-primary hover:underline"
            >
              Blabla2Go
            </Link>
            .
          </p>
        </div>
      </section>

      <div className="pt-12">
        <PendingBlock items={nonNativeTeachers.pending} />
      </div>
      <OfferCtaBand />
    </PublicOfferShell>
  )
}
