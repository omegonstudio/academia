'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Teacher } from '@academia/shared';
import { academicMutationErrorMessage } from '@/lib/academic-structure';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function GroupTeacherPanel({
  groupId,
  currentTeacherName,
  currentTeacherId,
  teachers,
  canWrite,
}: {
  groupId: string;
  currentTeacherName: string | null;
  currentTeacherId: string | null;
  teachers: readonly Teacher[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [teacherId, setTeacherId] = useState(currentTeacherId ?? '');

  const activeTeachers = teachers.filter((teacher) => teacher.isActive);

  async function assignOrReplace() {
    if (!teacherId) {
      setError('Elegí un docente.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId }),
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'group-teacher'));
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  async function removeTeacher() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/teacher`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'group-teacher'));
        return;
      }
      setTeacherId('');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-10 max-w-md" aria-labelledby="group-teacher-heading">
      <h2 id="group-teacher-heading" className="text-lg font-semibold text-ink">
        Docente del grupo
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {currentTeacherName
          ? `Actual: ${currentTeacherName}`
          : 'Sin docente asignado.'}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {canWrite ? (
        <div className="mt-4 space-y-3">
          <div>
            <label
              className="block text-sm font-medium text-ink"
              htmlFor="groupTeacherId"
            >
              Asignar o reemplazar
            </label>
            <select
              id="groupTeacherId"
              className={FIELD}
              value={teacherId}
              disabled={pending}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <option value="">Elegí un docente</option>
              {activeTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.lastName}, {teacher.firstName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending || !teacherId}
              onClick={() => void assignOrReplace()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
            >
              {pending
                ? 'Guardando…'
                : currentTeacherId
                  ? 'Reemplazar docente'
                  : 'Asignar docente'}
            </button>
            {currentTeacherId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void removeTeacher()}
                className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
              >
                Quitar docente
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
