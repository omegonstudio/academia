'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Teacher } from '@academia/shared';
import { TEACHER_AVAILABILITIES, TEACHER_LEVELS } from '@academia/shared';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function TeacherDetailActions({ teacher }: { teacher: Teacher }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [level, setLevel] = useState(teacher.level);
  const [availability, setAvailability] = useState(teacher.availability);

  async function saveProfile() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/teachers/${teacher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, availability }),
      });
      if (!response.ok) {
        setError(
          response.status === 403
            ? 'No tenés permiso para editar.'
            : 'No pudimos guardar los cambios.',
        );
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos.');
    } finally {
      setPending(false);
    }
  }

  async function deactivate() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/teachers/${teacher.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setError(
          response.status === 403
            ? 'No tenés permiso para desactivar.'
            : 'No pudimos desactivar el profesor.',
        );
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8 max-w-md space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="level">
          Nivel
        </label>
        <select
          id="level"
          className={FIELD}
          value={level}
          onChange={(event) => setLevel(event.target.value as Teacher['level'])}
        >
          {TEACHER_LEVELS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          className="block text-sm font-medium text-ink"
          htmlFor="availability"
        >
          Disponibilidad
        </label>
        <select
          id="availability"
          className={FIELD}
          value={availability}
          onChange={(event) =>
            setAvailability(event.target.value as Teacher['availability'])
          }
        >
          {TEACHER_AVAILABILITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void saveProfile()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {teacher.isActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void deactivate()}
            className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
          >
            Desactivar
          </button>
        ) : null}
      </div>
    </div>
  );
}
