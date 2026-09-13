import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateTeacherForm } from '@/components/create-teacher-form';
import { PageHeader } from '@/components/page-header';
import { fetchTeachers, getSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Profesores',
  robots: { index: false, follow: false },
};

export default async function TeachersPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const result = await fetchTeachers();

  return (
    <>
      <PageHeader
        title="Profesores"
        intro="Registro académico de profesores de la academia."
      />

      {!result.ok ? (
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
      ) : result.teachers.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no hay profesores cargados.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {result.teachers.map((teacher) => (
            <li key={teacher.id} className="flex items-baseline justify-between gap-4 py-3">
              <Link
                href={`/dashboard/teachers/${teacher.id}`}
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                {teacher.lastName}, {teacher.firstName}
              </Link>
              <span className="text-sm text-ink-muted">
                {teacher.level} · {teacher.availability}
                {teacher.isActive ? '' : ' · inactivo'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.ok || result.status === 403 ? <CreateTeacherForm /> : null}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </>
  );
}
