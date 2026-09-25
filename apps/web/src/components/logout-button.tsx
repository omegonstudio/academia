'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

type LogoutButtonProps = {
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
};

/**
 * Clears the HttpOnly session cookie via the API, then returns to /login.
 */
export function LogoutButton({
  className,
  children,
  'aria-label': ariaLabel,
}: LogoutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Cookie clear is best-effort; still leave the private area.
    } finally {
      router.replace('/login');
      router.refresh();
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel ?? 'Cerrar sesión'}
      disabled={pending}
      onClick={() => {
        void handleClick();
      }}
    >
      {children}
    </button>
  );
}
