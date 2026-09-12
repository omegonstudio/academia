import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Cursos de español',
  description:
    'Clases individuales de 60 o 90 minutos, clases grupales de 120 minutos y formación de profesores de español.',
  alternates: { canonical: '/courses' },
};

const COURSES = [
  {
    name: 'Clases individuales',
    detail: '60 o 90 minutos. Todos los niveles.',
    audience: 'Estudiantes que buscan un plan a medida.',
  },
  {
    name: 'Clases grupales',
    detail: '120 minutos, una vez por semana. Hasta 15 estudiantes.',
    audience: 'Grupos reducidos con seguimiento del docente.',
  },
  {
    name: 'Formación de profesores',
    detail: 'Programa para hablantes nativos de español.',
    audience: 'Quienes quieren incorporarse a la red de docentes.',
  },
] as const;

export default function CoursesPage() {
  return (
    <>
      <PageHeader
        title="Cursos"
        intro="Elegí la modalidad que mejor se adapte a tu objetivo y a tu disponibilidad."
      />

      {/* A description list keeps the offering machine-readable and crawlable. */}
      <dl className="grid gap-4 sm:grid-cols-2">
        {COURSES.map((course) => (
          <div
            key={course.name}
            className="rounded-lg border border-line bg-surface-muted p-5"
          >
            <dt className="font-semibold text-ink">{course.name}</dt>
            <dd className="mt-2 text-sm text-ink-muted">
              {course.detail}
              <span className="mt-1 block">{course.audience}</span>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
