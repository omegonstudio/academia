import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'La academia',
  description:
    'Quiénes somos: una academia de español dirigida por docentes, con formación propia de profesores.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="La academia"
        intro="Una academia de español dirigida por docentes, con formación propia de profesores y seguimiento de cada estudiante."
      />

      <section aria-labelledby="como-trabajamos">
        <h2 id="como-trabajamos" className="text-2xl font-semibold text-ink">
          Cómo trabajamos
        </h2>
        <p className="mt-4 max-w-2xl text-ink-muted">
          La dirección asigna cada estudiante a un docente de la red. Las clases
          se dictan en aulas virtuales externas y el seguimiento académico queda
          registrado en la plataforma.
        </p>
      </section>
    </>
  );
}
