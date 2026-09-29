import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { getSession } from '@/lib/api';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Private area gate: every /dashboard/** route requires a real API session.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  return (
    <>
      <a
        href="#contenido-panel"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido principal
      </a>
      <SessionProvider user={user}>{children}</SessionProvider>
    </>
  );
}
