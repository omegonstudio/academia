import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClassSessionDetailActions } from '@/components/class-session-detail-actions';
import { PageHeader } from '@/components/page-header';
import { fetchClassSession, fetchGroup, getSession } from '@/lib/api';
import {
  formatSessionTimeRange,
  serviceTypeLabel,
} from '@/lib/calendar';

export const metadata: Metadata = {
  title: 'Clase',
  robots: { index: false, follow: false },
};

export default async function ClassSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const { id } = await params;
  const result = await fetchClassSession(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Clase" />
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
        <p className="mt-6 text-sm">
          <Link href="/dashboard/classes" className="underline">
            Volver al listado
          </Link>
        </p>
      </>
    );
  }

  const { classSession } = result;
  const groupResult = await fetchGroup(classSession.groupId);
  const groupName = groupResult.ok ? groupResult.group.name : null;
  const title = groupName
    ? `${groupName}`
    : `Clase · ${formatSessionTimeRange(classSession.startAt, classSession.endAt)}`;

  return (
    <>
      <PageHeader
        title={title}
        intro={
          classSession.isActive
            ? 'Sesión activa.'
            : 'Sesión inactiva (baja lógica).'
        }
      />

      <dl className="grid max-w-lg gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Horario</dt>
          <dd className="text-right text-ink">
            {formatSessionTimeRange(classSession.startAt, classSession.endAt)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Modalidad</dt>
          <dd className="text-ink">
            {serviceTypeLabel(classSession.serviceType)} (
            {classSession.durationMinutes} min)
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Grupo</dt>
          <dd className="text-ink">{groupName ?? classSession.groupId}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Estado</dt>
          <dd className="text-ink">
            {classSession.isActive ? 'Activa' : 'Inactiva'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Reunión</dt>
          <dd className="text-right text-ink">
            {classSession.meetingUrl ? (
              <a
                href={classSession.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Abrir reunión
              </a>
            ) : (
              'Sin enlace'
            )}
          </dd>
        </div>
      </dl>

      {user.role !== 'STUDENT' ? (
        <ClassSessionDetailActions classSession={classSession} />
      ) : null}

      <p className="mt-8 text-sm">
        <Link href="/dashboard/classes" className="underline">
          Volver al listado
        </Link>
        {' · '}
        <Link href="/dashboard/calendar" className="underline">
          Ver calendario
        </Link>
      </p>
    </>
  );
}
