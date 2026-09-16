import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { fetchClassSessionCalendar, getSession } from '@/lib/api';
import {
  civilMonthRange,
  formatDayHeading,
  formatMonthHeading,
  formatSessionTimeRange,
  groupSessionsByCivilDay,
  resolveCivilMonthFromSearchParams,
  serviceTypeLabel,
  shiftCivilMonth,
} from '@/lib/calendar';

export const metadata: Metadata = {
  title: 'Calendario',
  robots: { index: false, follow: false },
};

function monthHref(year: number, month: number): string {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  return `/dashboard/calendar?${params.toString()}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const params = await searchParams;
  const month = resolveCivilMonthFromSearchParams(params);
  const { from, to } = civilMonthRange(month);
  const previous = shiftCivilMonth(month, -1);
  const next = shiftCivilMonth(month, 1);
  const result = await fetchClassSessionCalendar(from, to);
  const grouped =
    result.ok ? groupSessionsByCivilDay(result.classSessions) : [];

  return (
    <>
      <PageHeader
        title="Calendario"
        intro="Clases programadas según tu acceso. Los horarios usan la zona horaria de la academia."
      />

      <nav
        className="mb-6 flex flex-wrap items-center justify-between gap-3"
        aria-label="Mes del calendario"
      >
        <Link
          href={monthHref(previous.year, previous.month)}
          className="rounded-md border border-line px-3 py-2 text-sm text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Mes anterior
        </Link>
        <p className="text-base font-medium capitalize text-ink" aria-live="polite">
          {formatMonthHeading(month)}
        </p>
        <Link
          href={monthHref(next.year, next.month)}
          className="rounded-md border border-line px-3 py-2 text-sm text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Mes siguiente
        </Link>
      </nav>

      {!result.ok ? (
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
      ) : result.classSessions.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No hay clases programadas en {formatMonthHeading(month)}.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ day, sessions }) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2
                id={`day-${day}`}
                className="border-b border-line pb-2 text-lg font-semibold capitalize text-ink"
              >
                {formatDayHeading(day)}
              </h2>
              <ul className="divide-y divide-line">
                {sessions.map((session) => {
                  const teacherLabel = session.teacher
                    ? `${session.teacher.firstName} ${session.teacher.lastName}`
                    : 'Sin docente asignado';
                  return (
                    <li key={session.id} className="py-4">
                      <p className="font-medium text-ink">
                        <Link
                          href={`/dashboard/classes/${session.id}`}
                          className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          {session.group.course.name} · {session.group.name}
                        </Link>
                      </p>
                      <p className="mt-1 text-sm text-ink-muted">
                        {formatSessionTimeRange(session.startAt, session.endAt)}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted">
                        {teacherLabel}
                        {' · '}
                        {serviceTypeLabel(session.group.course.serviceType)}
                      </p>
                      {session.meetingUrl ? (
                        <p className="mt-2 text-sm">
                          <a
                            href={session.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          >
                            Abrir reunión
                          </a>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
        {' · '}
        <Link href="/dashboard/classes" className="underline">
          Ver listado de clases
        </Link>
      </p>
    </>
  );
}
