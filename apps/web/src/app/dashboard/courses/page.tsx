import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateCourseForm } from '@/components/create-course-form';
import { PageHeader } from '@/components/page-header';
import {
  canMutateAcademicStructureUi,
  courseServiceTypeLabel,
  courseTypeLabel,
} from '@/lib/academic-structure';
import { fetchCourses, getSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Cursos',
  robots: { index: false, follow: false },
};

export default async function CoursesPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const result = await fetchCourses();
  const canWrite = canMutateAcademicStructureUi(user.role);

  return (
    <>
      <PageHeader
        title="Cursos"
        intro="Ofertas académicas 1:1, grupo y formación docente."
      />

      {!result.ok ? (
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
      ) : result.courses.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no hay cursos cargados.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {result.courses.map((course) => (
            <li
              key={course.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <Link
                href={`/dashboard/courses/${course.id}`}
                className="font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {course.name}
              </Link>
              <span className="text-sm text-ink-muted">
                {courseTypeLabel(course.courseType)}
                {' · '}
                {courseServiceTypeLabel(course.serviceType)}
                {course.isActive ? '' : ' · inactivo'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (result.ok || result.status === 403) ? (
        <CreateCourseForm />
      ) : null}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </>
  );
}
