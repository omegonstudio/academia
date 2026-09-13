import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { TeacherDetailActions } from '@/components/teacher-detail-actions';
import { fetchTeacher, getSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Profesor',
  robots: { index: false, follow: false },
};

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const { id } = await params;
  const result = await fetchTeacher(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Profesor" />
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
        <p className="mt-6 text-sm">
          <Link href="/dashboard/teachers" className="underline">
            Volver al listado
          </Link>
        </p>
      </>
    );
  }

  const { teacher } = result;

  return (
    <>
      <PageHeader
        title={`${teacher.firstName} ${teacher.lastName}`}
        intro={teacher.isActive ? 'Perfil activo.' : 'Perfil inactivo.'}
      />

      <dl className="grid max-w-md gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Correo</dt>
          <dd className="text-ink">{teacher.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Nivel</dt>
          <dd className="text-ink">{teacher.level}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Disponibilidad</dt>
          <dd className="text-ink">{teacher.availability}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Estado</dt>
          <dd className="text-ink">{teacher.isActive ? 'Activo' : 'Inactivo'}</dd>
        </div>
      </dl>

      {user.role !== 'TEACHER' && user.role !== 'STUDENT' ? (
        <TeacherDetailActions teacher={teacher} />
      ) : null}

      <p className="mt-8 text-sm">
        <Link href="/dashboard/teachers" className="underline">
          Volver al listado
        </Link>
      </p>
    </>
  );
}
