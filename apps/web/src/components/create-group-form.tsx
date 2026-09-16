'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import type { Course } from '@academia/shared';
import { academicMutationErrorMessage } from '@/lib/academic-structure';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function CreateGroupForm({
  courses,
}: {
  courses: readonly Course[];
}) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const activeCourses = courses.filter((course) => course.isActive);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: String(form.get('courseId') ?? '').trim(),
          name: String(form.get('name') ?? '').trim(),
        }),
      });

      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'group'));
        return;
      }

      const payload = (await response.json()) as { group?: { id?: string } };
      if (payload.group?.id) {
        router.push(`/dashboard/groups/${payload.group.id}`);
        router.refresh();
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
    <form onSubmit={handleSubmit} noValidate className="mt-8 max-w-md space-y-4">
      <h2 className="text-lg font-semibold text-ink">Nuevo grupo</h2>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {activeCourses.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Necesitás al menos un curso activo para crear un grupo.
        </p>
      ) : (
        <>
          <div>
            <label
              className="block text-sm font-medium text-ink"
              htmlFor="courseId"
            >
              Curso
            </label>
            <select id="courseId" name="courseId" required className={FIELD}>
              <option value="">Elegí un curso</option>
              {activeCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="name">
              Nombre del grupo
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={120}
              className={FIELD}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Crear grupo'}
          </button>
        </>
      )}
      <p className="text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </form>
  );
}
