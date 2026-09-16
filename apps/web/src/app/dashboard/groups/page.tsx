import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateGroupForm } from '@/components/create-group-form';
import { PageHeader } from '@/components/page-header';
import { canMutateAcademicStructureUi } from '@/lib/academic-structure';
import { fetchCourses, fetchGroups, getSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Grupos',
  robots: { index: false, follow: false },
};

export default async function GroupsPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const [groupsResult, coursesResult] = await Promise.all([
    fetchGroups(),
    fetchCourses(),
  ]);
  const canWrite = canMutateAcademicStructureUi(user.role);

  const courseNameById = new Map(
    coursesResult.ok
      ? coursesResult.courses.map((course) => [course.id, course.name] as const)
      : [],
  );

  return (
    <>
      <PageHeader
        title="Grupos"
        intro="Cohortes vinculadas a un curso, con docente y franja opcionales."
      />

      {!groupsResult.ok ? (
        <p role="alert" className="text-sm text-danger">
          {groupsResult.message}
        </p>
      ) : groupsResult.groups.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no hay grupos cargados.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {groupsResult.groups.map((group) => (
            <li
              key={group.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <Link
                href={`/dashboard/groups/${group.id}`}
                className="font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {group.name}
              </Link>
              <span className="text-sm text-ink-muted">
                {courseNameById.get(group.courseId) ?? 'Curso'}
                {group.isActive ? '' : ' · inactivo'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (groupsResult.ok || groupsResult.status === 403) ? (
        <CreateGroupForm
          courses={coursesResult.ok ? coursesResult.courses : []}
        />
      ) : null}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
        {' · '}
        <Link href="/dashboard/courses" className="underline">
          Ver cursos
        </Link>
      </p>
    </>
  );
}
