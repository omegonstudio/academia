'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { COURSE_SERVICE_TYPES, COURSE_TYPES } from '@academia/shared';
import {
  academicMutationErrorMessage,
  courseServiceTypeLabel,
  courseTypeLabel,
  derivedDurationLabel,
} from '@/lib/academic-structure';
import type { CourseServiceType } from '@academia/shared';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function CreateCourseForm() {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [serviceType, setServiceType] =
    useState<CourseServiceType>('ONE_TO_ONE_60');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);

    const description = String(form.get('description') ?? '').trim();
    const body: {
      name: string;
      courseType: string;
      serviceType: string;
      description?: string;
    } = {
      name: String(form.get('name') ?? '').trim(),
      courseType: String(form.get('courseType') ?? ''),
      serviceType: String(form.get('serviceType') ?? ''),
    };
    if (description) {
      body.description = description;
    }

    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'course'));
        return;
      }

      const payload = (await response.json()) as { course?: { id?: string } };
      if (payload.course?.id) {
        router.push(`/dashboard/courses/${payload.course.id}`);
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
      <h2 className="text-lg font-semibold text-ink">Nuevo curso</h2>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="name">
          Nombre
        </label>
        <input id="name" name="name" required maxLength={120} className={FIELD} />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-ink"
          htmlFor="description"
        >
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className={FIELD}
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-ink"
          htmlFor="courseType"
        >
          Tipo de curso
        </label>
        <select
          id="courseType"
          name="courseType"
          required
          className={FIELD}
          defaultValue="REGULAR"
        >
          {COURSE_TYPES.map((value) => (
            <option key={value} value={value}>
              {courseTypeLabel(value)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          className="block text-sm font-medium text-ink"
          htmlFor="serviceType"
        >
          Modalidad
        </label>
        <select
          id="serviceType"
          name="serviceType"
          required
          className={FIELD}
          value={serviceType}
          onChange={(event) =>
            setServiceType(event.target.value as CourseServiceType)
          }
        >
          {COURSE_SERVICE_TYPES.map((value) => (
            <option key={value} value={value}>
              {courseServiceTypeLabel(value)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-muted">
          Duración derivada: {derivedDurationLabel(serviceType)}
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
      >
        {pending ? 'Guardando…' : 'Crear curso'}
      </button>
      <p className="text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </form>
  );
}
