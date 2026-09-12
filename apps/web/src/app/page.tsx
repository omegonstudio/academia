import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Academia de español online',
  description: site.description,
  alternates: { canonical: '/' },
};

const OFFERINGS = [
  {
    title: 'Clases individuales',
    body: 'Encuentros de 60 o 90 minutos, adaptados al nivel de cada estudiante.',
  },
  {
    title: 'Clases grupales',
    body: 'Grupos reducidos de hasta 15 personas, una vez por semana.',
  },
  {
    title: 'Formación de docentes',
    body: 'Programa para hablantes nativos que quieren enseñar español.',
  },
] as const;

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="Aprendé español con acompañamiento real"
        intro={site.description}
      >
        <p className="mt-6">
          <Link
            href="/courses"
            className="inline-block rounded-md bg-brand px-5 py-3 font-medium text-on-brand hover:bg-brand-strong"
          >
            Ver los cursos
          </Link>
        </p>
      </PageHeader>

      <section aria-labelledby="propuesta">
        <h2 id="propuesta" className="text-2xl font-semibold text-ink">
          Nuestra propuesta
        </h2>

        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {OFFERINGS.map((offering) => (
            <li
              key={offering.title}
              className="rounded-lg border border-line bg-surface-muted p-5"
            >
              <h3 className="font-semibold text-ink">{offering.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{offering.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
