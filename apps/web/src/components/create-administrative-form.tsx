'use client';

import { useId, useState } from 'react';
import { identityMutationErrorMessage } from '@/lib/stage1-identity';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

/**
 * Provisions an ADMINISTRATIVE user via POST /users/administratives.
 * There is no list endpoint for administratives — create-only surface.
 */
export function CreateAdministrativeForm() {
  const errorId = useId();
  const successId = useId();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();

    try {
      const response = await fetch('/api/users/administratives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          ...(name ? { name } : {}),
        }),
      });

      if (!response.ok) {
        setError(identityMutationErrorMessage(response.status, 'administrative'));
        return;
      }

      const body = (await response.json()) as {
        user?: { email?: string };
      };
      const email = body.user?.email ?? 'cuenta';
      setSuccess(
        response.status === 201
          ? `Administrativo creado: ${email}.`
          : `La cuenta ya existía como administrativo: ${email}.`,
      );
      event.currentTarget.reset();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 max-w-md space-y-4">
      <h2 className="text-lg font-semibold text-ink">Nuevo administrativo</h2>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {success ? (
        <p id={successId} role="status" className="text-sm text-ink">
          {success}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="admin-email">
          Correo
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          disabled={pending}
          className={FIELD}
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-ink"
          htmlFor="admin-password"
        >
          Contraseña inicial
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          disabled={pending}
          className={FIELD}
        />
        <p className="mt-1 text-xs text-ink-muted">Mínimo 12 caracteres.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="admin-name">
          Nombre (opcional)
        </label>
        <input
          id="admin-name"
          name="name"
          type="text"
          maxLength={120}
          disabled={pending}
          className={FIELD}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {pending ? 'Creando…' : 'Crear administrativo'}
      </button>
    </form>
  );
}
