'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Teacher } from '@academia/shared';
import { academicMutationErrorMessage } from '@/lib/academic-structure';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function StudentAssignmentRow({
  studentId,
  studentName,
  teacherId,
  teachers,
  canWrite,
}: {
  studentId: string;
  studentName: string;
  teacherId: string | null;
  teachers: ReadonlyMap<string, Teacher>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState(teacherId ?? '');

  const currentTeacher = teacherId ? teachers.get(teacherId) : undefined;
  const currentLabel = currentTeacher
    ? `${currentTeacher.lastName}, ${currentTeacher.firstName}`
    : teacherId
      ? 'Docente desconocido'
      : 'Sin docente';

  const activeTeachers = [...teachers.values()].filter(
    (teacher) => teacher.isActive,
  );

  async function assignOrReplace() {
    if (!selectedTeacherId) {
      setError('Elegí un docente.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/students/${studentId}/teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: selectedTeacherId }),
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'assignment'));
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  async function removeAssignment() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/students/${studentId}/teacher`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'assignment'));
        return;
      }
      setSelectedTeacherId('');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="font-medium text-ink">{studentName}</p>
        <p className="text-sm text-ink-muted">{currentLabel}</p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {canWrite ? (
        <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              className="block text-sm font-medium text-ink"
              htmlFor={`teacher-${studentId}`}
            >
              Docente
            </label>
            <select
              id={`teacher-${studentId}`}
              className={FIELD}
              value={selectedTeacherId}
              disabled={pending}
              onChange={(event) => setSelectedTeacherId(event.target.value)}
            >
              <option value="">Elegí un docente</option>
              {activeTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.lastName}, {teacher.firstName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !selectedTeacherId}
              onClick={() => void assignOrReplace()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
            >
              {pending
                ? 'Guardando…'
                : teacherId
                  ? 'Reemplazar'
                  : 'Asignar'}
            </button>
            {teacherId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void removeAssignment()}
                className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
              >
                Quitar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
