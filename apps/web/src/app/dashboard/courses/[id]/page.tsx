import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CourseDetailActions } from '@/components/course-detail-actions';
import { PageHeader } from '@/components/page-header';
import {
  canMutateAcademicStructureUi,
  courseServiceTypeLabel,
  courseTypeLabel,
  derivedDurationLabel,
} from '@/lib/academic-structure';
import { fetchCourse, getSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Curso',
  robots: { index: false, follow: false },
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const { id } = await params;
  const result = await fetchCourse(id);
  const canWrite = canMutateAcademicStructureUi(user.role);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Curso" />
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
        <p className="mt-6 text-sm">
          <Link href="/dashboard/courses" className="underline">
            Volver al listado
          </Link>
        </p>
      </>
    );
  }

  const { course } = result;

  return (
    <>
      <PageHeader
        title={course.name}
        intro={course.isActive ? 'Curso activo.' : 'Curso inactivo.'}
      />

      <dl className="grid max-w-md gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Descripción</dt>
          <dd className="text-right text-ink">
            {course.description?.trim() ? course.description : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Tipo</dt>
          <dd className="text-ink">{courseTypeLabel(course.courseType)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Modalidad</dt>
          <dd className="text-ink">
            {courseServiceTypeLabel(course.serviceType)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Duración</dt>
          <dd className="text-ink">
            {derivedDurationLabel(course.serviceType)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Estado</dt>
          <dd className="text-ink">
            {course.isActive ? 'Activo' : 'Inactivo'}
          </dd>
        </div>
      </dl>

      {canWrite ? <CourseDetailActions course={course} /> : null}

      <p className="mt-8 text-sm">
        <Link href="/dashboard/courses" className="underline">
          Volver al listado
        </Link>
      </p>
    </>
  );
}
