import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Docentes',
  description:
    'La red de docentes de la academia: profesores formados por la institución y asignados por la dirección.',
  alternates: { canonical: '/teachers' },
};

export default function TeachersPage() {
  return (
    <>
      <PageHeader
        title="Docentes"
        intro="Nuestra red está formada por profesores que se capacitaron en la academia y fueron incorporados por la dirección."
      />

      <section aria-labelledby="red-docente">
        <h2 id="red-docente" className="text-2xl font-semibold text-ink">
          Cómo se integra la red
        </h2>
        <ol className="mt-4 max-w-2xl list-decimal space-y-2 pl-5 text-ink-muted">
          <li>El profesor se forma en el programa de la academia.</li>
          <li>La dirección lo incorpora como docente.</li>
          <li>La dirección le asigna estudiantes.</li>
        </ol>

        {/*
          No public teacher directory in the MVP: teacher data stays private
          until a stage explicitly introduces it.
        */}
        <p className="mt-6 text-sm text-ink-muted">
          El listado público de docentes estará disponible más adelante.
        </p>
      </section>
    </>
  );
}
