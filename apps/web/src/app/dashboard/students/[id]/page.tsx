import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { StudentDetailActions } from '@/components/student-detail-actions';
import { fetchStudent, getSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Estudiante',
  robots: { index: false, follow: false },
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const { id } = await params;
  const result = await fetchStudent(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Estudiante" />
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
        <p className="mt-6 text-sm">
          <Link href="/dashboard/students" className="underline">
            Volver al listado
          </Link>
        </p>
      </>
    );
  }

  const { student } = result;

  return (
    <>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        intro={student.isActive ? 'Perfil activo.' : 'Perfil inactivo.'}
      />

      <dl className="grid max-w-md gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Correo</dt>
          <dd className="text-ink">{student.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Nivel</dt>
          <dd className="text-ink">{student.level}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Estado</dt>
          <dd className="text-ink">{student.isActive ? 'Activo' : 'Inactivo'}</dd>
        </div>
      </dl>

      {user.role !== 'STUDENT' ? (
        <StudentDetailActions student={student} />
      ) : null}

      <p className="mt-8 text-sm">
        <Link href="/dashboard/students" className="underline">
          Volver al listado
        </Link>
      </p>
    </>
  );
}
