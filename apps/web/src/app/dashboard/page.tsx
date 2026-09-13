import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/api';
import { dashboardContentForRole } from '@/lib/dashboard-content';
import { roleLabel } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false },
};

/**
 * Private entry point. Session and role come from the API (`/auth/me`);
 * content is chosen server-side from that role.
 */
export default async function DashboardPage() {
  const user = await getSession();

  if (!user) redirect('/login');

  const roleContent = dashboardContentForRole(user.role);

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

      <section
        className="mt-8 max-w-2xl"
        aria-labelledby="dashboard-role-heading"
      >
        <h2
          id="dashboard-role-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {roleContent.heading}
        </h2>
        <p className="mt-3 text-base text-ink-muted">{roleContent.summary}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink">
          {roleContent.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <LogoutButton />
      </div>
    </>
  );
}
