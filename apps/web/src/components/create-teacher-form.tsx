'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { TEACHER_AVAILABILITIES, TEACHER_LEVELS } from '@academia/shared';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function CreateTeacherForm() {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          firstName: String(form.get('firstName') ?? ''),
          lastName: String(form.get('lastName') ?? ''),
          level: String(form.get('level') ?? ''),
          availability: String(form.get('availability') ?? 'AVAILABLE'),
        }),
      });

      if (!response.ok) {
        setError(
          response.status === 403
            ? 'No tenés permiso para crear profesores.'
            : response.status === 409
              ? 'Ese correo ya está en uso.'
              : 'Revisá los datos e intentá de nuevo.',
        );
        return;
      }

      const body = (await response.json()) as { teacher?: { id?: string } };
      if (body.teacher?.id) {
        router.push(`/dashboard/teachers/${body.teacher.id}`);
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
      <h2 className="text-lg font-semibold text-ink">Nuevo profesor</h2>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="email">
          Correo
        </label>
        <input id="email" name="email" type="email" required className={FIELD} />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="password">
          Contraseña inicial
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={12}
          className={FIELD}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="firstName">
          Nombre
        </label>
        <input id="firstName" name="firstName" required className={FIELD} />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="lastName">
          Apellido
        </label>
        <input id="lastName" name="lastName" required className={FIELD} />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="level">
          Nivel
        </label>
        <select id="level" name="level" required className={FIELD} defaultValue="C1">
          {TEACHER_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
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
          name="availability"
          required
          className={FIELD}
          defaultValue="AVAILABLE"
        >
          {TEACHER_AVAILABILITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
      >
        {pending ? 'Guardando…' : 'Crear profesor'}
      </button>
      <p className="text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </form>
  );
}
