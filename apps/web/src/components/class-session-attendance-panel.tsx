'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AttendanceStatus } from '@academia/shared';
import {
  attendanceMutationErrorMessage,
  attendanceStatusLabel,
  studentDisplayName,
  type AttendanceRosterRow,
} from '@/lib/class-session-attendance';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function ClassSessionAttendancePanel({
  classSessionId,
  sessionActive,
  canWrite,
  enrollmentsUnavailable,
  initialRows,
}: {
  classSessionId: string;
  sessionActive: boolean;
  canWrite: boolean;
  enrollmentsUnavailable: boolean;
  initialRows: readonly AttendanceRosterRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);

  async function setStatus(studentId: string, status: AttendanceStatus, isUpdate: boolean) {
    setError(null);
    setPendingStudentId(studentId);
    try {
      const response = await fetch(
        isUpdate
          ? `/api/classes/${classSessionId}/attendance/${studentId}`
          : `/api/classes/${classSessionId}/attendance`,
        {
          method: isUpdate ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isUpdate ? { status } : { studentId, status },
          ),
        },
      );
      if (!response.ok) {
        setError(attendanceMutationErrorMessage(response.status));
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPendingStudentId(null);
    }
  }

  return (
    <section className="mt-10 max-w-lg" aria-labelledby="attendance-heading">
      <h2 id="attendance-heading" className="text-lg font-semibold text-ink">
        Asistencia
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Presente o ausente por estudiante. La autorización la confirma el servidor.
      </p>

      {!sessionActive && canWrite ? (
        <p className="mt-3 text-sm text-ink-muted" role="status">
          La clase está inactiva: no se puede modificar la asistencia.
        </p>
      ) : null}

      {enrollmentsUnavailable && canWrite ? (
        <p className="mt-3 text-sm text-ink-muted" role="status">
          No se pudo cargar el listado de inscriptos del grupo. Se muestran los
          registros de asistencia ya existentes.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {initialRows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          {canWrite
            ? 'No hay estudiantes para registrar asistencia en esta clase.'
            : 'No hay asistencia registrada para vos en esta clase.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {initialRows.map((row) => {
            const pending = pendingStudentId === row.studentId;
            const hasRecord = row.status !== null;
            return (
              <li
                key={row.studentId}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">{studentDisplayName(row)}</p>
                  <p className="text-sm text-ink-muted">
                    {attendanceStatusLabel(row.status)}
                  </p>
                </div>
                {canWrite && sessionActive ? (
                  <div className="flex flex-wrap gap-2">
                    <label className="sr-only" htmlFor={`attendance-${row.studentId}`}>
                      Estado de asistencia de {studentDisplayName(row)}
                    </label>
                    <select
                      id={`attendance-${row.studentId}`}
                      className={FIELD}
                      disabled={pending}
                      value={row.status ?? ''}
                      onChange={(event) => {
                        const value = event.target.value as AttendanceStatus;
                        if (value !== 'PRESENT' && value !== 'ABSENT') return;
                        void setStatus(row.studentId, value, hasRecord);
                      }}
                    >
                      <option value="" disabled>
                        Elegir…
                      </option>
                      <option value="PRESENT">Presente</option>
                      <option value="ABSENT">Ausente</option>
                    </select>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
