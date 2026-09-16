import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClassSessionAttendancePanel } from '@/components/class-session-attendance-panel';
import { ClassSessionDetailActions } from '@/components/class-session-detail-actions';
import { ClassSessionNotesPanel } from '@/components/class-session-notes-panel';
import { PageHeader } from '@/components/page-header';
import {
  fetchClassSession,
  fetchClassSessionAttendance,
  fetchClassSessionNotes,
  fetchGroup,
  fetchGroupEnrollments,
  fetchStudents,
  getSession,
} from '@/lib/api';
import {
  formatSessionTimeRange,
  serviceTypeLabel,
} from '@/lib/calendar';
import {
  buildAttendanceRoster,
  canMutateAttendanceUi,
  type AttendanceRosterRow,
} from '@/lib/class-session-attendance';
import { canMutateNotesUi } from '@/lib/class-session-notes';

export const metadata: Metadata = {
  title: 'Clase',
  robots: { index: false, follow: false },
};

function enrichRosterNames(
  rows: AttendanceRosterRow[],
  namesByStudentId: Map<string, { firstName: string; lastName: string }>,
): AttendanceRosterRow[] {
  return rows.map((row) => {
    if (row.firstName && row.lastName) return row;
    const named = namesByStudentId.get(row.studentId);
    if (!named) return row;
    return {
      ...row,
      firstName: named.firstName,
      lastName: named.lastName,
    };
  });
}

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
  const [groupResult, attendanceResult, notesResult, enrollmentsResult, studentsResult] =
    await Promise.all([
      fetchGroup(classSession.groupId),
      fetchClassSessionAttendance(classSession.id),
      fetchClassSessionNotes(classSession.id),
      fetchGroupEnrollments(classSession.groupId),
      fetchStudents(),
    ]);

  const groupName = groupResult.ok ? groupResult.group.name : null;
  const title = groupName
    ? `${groupName}`
    : `Clase · ${formatSessionTimeRange(classSession.startAt, classSession.endAt)}`;

  const canWriteAttendance = canMutateAttendanceUi(user.role);
  const canWriteNotes = canMutateNotesUi(user.role);

  const namesByStudentId = new Map(
    studentsResult.ok
      ? studentsResult.students.map(
          (student) =>
            [
              student.id,
              { firstName: student.firstName, lastName: student.lastName },
            ] as const,
        )
      : [],
  );

  const attendanceRows = attendanceResult.ok
    ? enrichRosterNames(
        buildAttendanceRoster({
          enrollments: enrollmentsResult.ok ? enrollmentsResult.enrollments : null,
          attendances: attendanceResult.attendances,
        }),
        namesByStudentId,
      )
    : [];

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

      {!attendanceResult.ok ? (
        <section className="mt-10 max-w-lg" aria-labelledby="attendance-heading">
          <h2 id="attendance-heading" className="text-lg font-semibold text-ink">
            Asistencia
          </h2>
          <p role="alert" className="mt-3 text-sm text-danger">
            {attendanceResult.message}
          </p>
        </section>
      ) : (
        <ClassSessionAttendancePanel
          classSessionId={classSession.id}
          sessionActive={classSession.isActive}
          canWrite={canWriteAttendance}
          enrollmentsUnavailable={!enrollmentsResult.ok}
          initialRows={attendanceRows}
        />
      )}

      {!notesResult.ok ? (
        <section className="mt-10 max-w-lg" aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="text-lg font-semibold text-ink">
            Notas de la clase
          </h2>
          <p role="alert" className="mt-3 text-sm text-danger">
            {notesResult.message}
          </p>
        </section>
      ) : (
        <ClassSessionNotesPanel
          classSessionId={classSession.id}
          sessionActive={classSession.isActive}
          canWrite={canWriteNotes}
          initialNotes={notesResult.notes}
        />
      )}

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
