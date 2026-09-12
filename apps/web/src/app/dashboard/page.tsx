import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/api';
import { roleLabel } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false },
};

/**
 * Private entry point.
 *
 * Stage 0 only proves that identity flows end to end: the session is resolved
 * server-side and the role is displayed. The per-role dashboards and every
 * academy module belong to later stages and are deliberately absent — an empty
 * panel is preferable to buttons that do nothing.
 */
export default async function DashboardPage() {
  const user = await getSession();

  // Server-side gate. The redirect happens before any private markup is sent.
  if (!user) redirect('/login');

  return (
    <>
      <PageHeader
        title="Panel"
        intro={`Sesión activa como ${roleLabel(user.role)}.`}
      />

      <dl className="grid max-w-md gap-3 rounded-lg border border-line bg-surface-muted p-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Nombre</dt>
          <dd className="text-ink">{user.name ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Correo</dt>
          <dd className="text-ink">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Rol</dt>
          <dd className="text-ink">{roleLabel(user.role)}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-ink-muted">
        Los módulos de la academia se habilitarán en las próximas etapas.
      </p>

      <div className="mt-8">
        <LogoutButton />
      </div>
    </>
  );
}
