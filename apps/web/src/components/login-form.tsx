'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

const FIELD_CLASSES =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

/**
 * Credential form.
 *
 * Posts to the same-origin `/api` proxy so the API can set an HttpOnly session
 * cookie; the token itself is never handled by client JavaScript.
 */
export function LoginForm() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        }),
      });

      if (!response.ok) {
        // The API answers identically for every failure, so the UI does not
        // reveal whether the address exists.
        setError(
          response.status === 429
            ? 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
            : 'El correo o la contraseña no son correctos.',
        );
        return;
      }

      // The session lives in a cookie, so the server components must re-render.
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-sm">
      {/*
        role="alert" announces the message as soon as it appears, and
        aria-describedby ties it to both fields for screen-reader users.
      */}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mb-4 rounded-md border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="mb-4">
        <label htmlFor={emailId} className="block text-sm font-medium text-ink">
          Correo electrónico
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={error ? errorId : undefined}
          className={FIELD_CLASSES}
        />
      </div>

      <div className="mb-6">
        <label htmlFor={passwordId} className="block text-sm font-medium text-ink">
          Contraseña
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-describedby={error ? errorId : undefined}
          className={FIELD_CLASSES}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-strong disabled:opacity-70"
      >
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  );
}
