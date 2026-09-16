'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  COURSE_SERVICE_TYPES,
  COURSE_TYPES,
  type Course,
  type CourseServiceType,
  type CourseType,
} from '@academia/shared';
import {
  academicMutationErrorMessage,
  courseServiceTypeLabel,
  courseTypeLabel,
  derivedDurationLabel,
} from '@/lib/academic-structure';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function CourseDetailActions({ course }: { course: Course }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description ?? '');
  const [courseType, setCourseType] = useState<CourseType>(course.courseType);
  const [serviceType, setServiceType] = useState<CourseServiceType>(
    course.serviceType,
  );

  async function saveChanges() {
    setError(null);
    setPending(true);
    const trimmedDescription = description.trim();
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: trimmedDescription.length > 0 ? trimmedDescription : null,
          courseType,
          serviceType,
        }),
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'course'));
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
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'course'));
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos.');
    } finally {
      setPending(false);
    }
  }

  async function reactivate() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'course'));
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
      <h2 className="text-lg font-semibold text-ink">Editar curso</h2>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="name">
          Nombre
        </label>
        <input
          id="name"
          className={FIELD}
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
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
          rows={3}
          maxLength={500}
          className={FIELD}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
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
          className={FIELD}
          value={courseType}
          onChange={(event) => setCourseType(event.target.value as CourseType)}
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
        <p className="mt-1 text-sm text-ink-muted">
          Duración: {derivedDurationLabel(serviceType)}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void saveChanges()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {course.isActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void deactivate()}
            className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
          >
            Desactivar
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void reactivate()}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
          >
            Reactivar
          </button>
        )}
      </div>
    </div>
  );
}
