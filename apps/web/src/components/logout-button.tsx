'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Clears the session cookie through the API, then returns to the public site. */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-70"
    >
      {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  );
}
