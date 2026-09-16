'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Enrollment, Student } from '@academia/shared';
import {
  academicMutationErrorMessage,
  enrollmentCapacityLabel,
  isAtEnrollmentCapacity,
} from '@/lib/academic-structure';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function GroupEnrollmentPanel({
  groupId,
  enrollments,
  students,
  canWrite,
}: {
  groupId: string;
  enrollments: readonly Enrollment[];
  students: ReadonlyMap<string, Student>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [studentId, setStudentId] = useState('');

  const activeEnrollments = enrollments.filter((row) => row.isActive);
  const activeCount = activeEnrollments.length;
  const atCapacity = isAtEnrollmentCapacity(activeCount);
  const enrolledIds = new Set(activeEnrollments.map((row) => row.studentId));
  const availableStudents = [...students.values()].filter(
    (student) => student.isActive && !enrolledIds.has(student.id),
  );

  function studentLabel(id: string): string {
    const student = students.get(id);
    if (!student) return id;
    return `${student.lastName}, ${student.firstName}`;
  }

  async function enroll() {
    if (!studentId) {
      setError('Elegí un estudiante.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'enrollment'));
        return;
      }
      setStudentId('');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  async function removeEnrollment(targetStudentId: string) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/students/${targetStudentId}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'enrollment'));
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="mt-10 max-w-lg"
      aria-labelledby="group-enrollment-heading"
    >
      <h2
        id="group-enrollment-heading"
        className="text-lg font-semibold text-ink"
      >
        Estudiantes del grupo
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Capacidad: {enrollmentCapacityLabel(activeCount)}
        {atCapacity ? ' · completo' : ''}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {activeEnrollments.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          Todavía no hay estudiantes inscriptos.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {activeEnrollments.map((enrollment) => (
            <li
              key={enrollment.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-ink">
                {studentLabel(enrollment.studentId)}
              </span>
              {canWrite ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void removeEnrollment(enrollment.studentId)}
                  className="rounded-md border border-danger px-3 py-1.5 text-sm font-medium text-danger disabled:opacity-60"
                >
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <div className="mt-4 space-y-3">
          <div>
            <label
              className="block text-sm font-medium text-ink"
              htmlFor="enrollStudentId"
            >
              Inscribir estudiante
            </label>
            <select
              id="enrollStudentId"
              className={FIELD}
              value={studentId}
              disabled={pending || atCapacity}
              onChange={(event) => setStudentId(event.target.value)}
            >
              <option value="">
                {atCapacity
                  ? 'Cupo completo (15)'
                  : 'Elegí un estudiante'}
              </option>
              {availableStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.lastName}, {student.firstName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={pending || atCapacity || !studentId}
            onClick={() => void enroll()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Inscribir'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
