import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateClassSessionForm } from '@/components/create-class-session-form';
import { PageHeader } from '@/components/page-header';
import { fetchClassSessions, fetchGroups, getSession } from '@/lib/api';
import {
  formatSessionTimeRange,
  serviceTypeLabel,
} from '@/lib/calendar';

export const metadata: Metadata = {
  title: 'Clases',
  robots: { index: false, follow: false },
};

export default async function ClassesPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const [sessionsResult, groupsResult] = await Promise.all([
    fetchClassSessions(),
    fetchGroups(),
  ]);

  const groupNameById = new Map(
    groupsResult.ok
      ? groupsResult.groups.map((group) => [group.id, group.name] as const)
      : [],
  );

  const canShowCreate = user.role !== 'STUDENT';

  return (
    <>
      <PageHeader
        title="Clases"
        intro="Sesiones programadas según tu acceso. La autorización la resuelve el servidor."
      />

      {!sessionsResult.ok ? (
        <p role="alert" className="text-sm text-danger">
          {sessionsResult.message}
        </p>
      ) : sessionsResult.classSessions.length === 0 ? (
        <p className="text-sm text-ink-muted">Todavía no hay clases cargadas.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {sessionsResult.classSessions.map((session) => {
            const groupLabel =
              groupNameById.get(session.groupId) ?? 'Grupo';
            return (
              <li
                key={session.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <Link
                  href={`/dashboard/classes/${session.id}`}
                  className="font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {groupLabel}
                  {' · '}
                  {formatSessionTimeRange(session.startAt, session.endAt)}
                </Link>
                <span className="text-sm text-ink-muted">
                  {serviceTypeLabel(session.serviceType)}
                  {session.isActive ? '' : ' · inactiva'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {canShowCreate &&
      (sessionsResult.ok || sessionsResult.status === 403) ? (
        <CreateClassSessionForm
          groups={groupsResult.ok ? groupsResult.groups : []}
        />
      ) : null}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
        {' · '}
        <Link href="/dashboard/calendar" className="underline">
          Ver calendario
        </Link>
      </p>
    </>
  );
}
