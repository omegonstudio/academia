import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateStudentForm } from '@/components/create-student-form';
import { PageHeader } from '@/components/page-header';
import { fetchStudents, getSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Estudiantes',
  robots: { index: false, follow: false },
};

export default async function StudentsPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const result = await fetchStudents();

  return (
    <>
      <PageHeader
        title="Estudiantes"
        intro="Registro académico de estudiantes de la academia."
      />

      {!result.ok ? (
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
      ) : result.students.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no hay estudiantes cargados.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {result.students.map((student) => (
            <li key={student.id} className="flex items-baseline justify-between gap-4 py-3">
              <Link
                href={`/dashboard/students/${student.id}`}
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                {student.lastName}, {student.firstName}
              </Link>
              <span className="text-sm text-ink-muted">
                {student.level}
                {student.isActive ? '' : ' · inactivo'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.ok || result.status === 403 ? <CreateStudentForm /> : null}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </>
  );
}
