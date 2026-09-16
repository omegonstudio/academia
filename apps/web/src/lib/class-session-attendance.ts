import type {
  Attendance,
  AttendanceStatus,
  Enrollment,
  Role,
} from '@academia/shared';

export type AttendanceRosterRow = {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  status: AttendanceStatus | null;
};

/**
 * Builds the attendance roster for UI.
 * Prefer active enrollments when available; otherwise fall back to attendance rows
 * (e.g. STUDENT self-scope or callers without `groups.read`).
 */
export function buildAttendanceRoster(input: {
  enrollments: readonly Enrollment[] | null;
  attendances: readonly Attendance[];
}): AttendanceRosterRow[] {
  const byStudent = new Map(
    input.attendances.map((row) => [row.studentId, row] as const),
  );

  if (input.enrollments) {
    const active = input.enrollments.filter((row) => row.isActive);
    const fromEnrollments = active.map((enrollment) => {
      const attendance = byStudent.get(enrollment.studentId);
      return {
        studentId: enrollment.studentId,
        firstName: attendance?.student.firstName ?? null,
        lastName: attendance?.student.lastName ?? null,
        status: attendance?.status ?? null,
      } satisfies AttendanceRosterRow;
    });

    // Historical attendance for students no longer actively enrolled (#37).
    const enrolledIds = new Set(active.map((row) => row.studentId));
    const historical = input.attendances
      .filter((row) => !enrolledIds.has(row.studentId))
      .map((row) => ({
        studentId: row.studentId,
        firstName: row.student.firstName,
        lastName: row.student.lastName,
        status: row.status,
      }));

    return [...fromEnrollments, ...historical].sort((a, b) =>
      attendanceRosterSortKey(a).localeCompare(attendanceRosterSortKey(b), 'es'),
    );
  }

  return input.attendances
    .map((row) => ({
      studentId: row.studentId,
      firstName: row.student.firstName,
      lastName: row.student.lastName,
      status: row.status,
    }))
    .sort((a, b) =>
      attendanceRosterSortKey(a).localeCompare(attendanceRosterSortKey(b), 'es'),
    );
}

function attendanceRosterSortKey(row: AttendanceRosterRow): string {
  if (row.lastName && row.firstName) {
    return `${row.lastName} ${row.firstName}`.toLowerCase();
  }
  return row.studentId;
}

export function studentDisplayName(row: AttendanceRosterRow): string {
  if (row.lastName && row.firstName) {
    return `${row.lastName}, ${row.firstName}`;
  }
  return 'Estudiante';
}

export function attendanceStatusLabel(status: AttendanceStatus | null): string {
  switch (status) {
    case 'PRESENT':
      return 'Presente';
    case 'ABSENT':
      return 'Ausente';
    case null:
      return 'Sin registrar';
    default:
      return status;
  }
}

/** UX gate only — API remains the security boundary. */
export function canMutateAttendanceUi(role: Role): boolean {
  return role !== 'STUDENT';
}

export function attendanceMutationErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'No se pudo registrar la asistencia. Revisá que el estudiante esté inscripto y la clase activa.';
    case 403:
      return 'No tenés permiso para modificar la asistencia.';
    case 404:
      return 'No encontramos la clase o el registro de asistencia.';
    case 409:
      return 'Esa asistencia ya estaba registrada. Actualizá el estado en lugar de crearla de nuevo.';
    default:
      return 'No pudimos guardar la asistencia. Intentá de nuevo.';
  }
}
