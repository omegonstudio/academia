import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdministrativePermissionsPanel } from '@/components/administrative-permissions-panel';
import { PageHeader } from '@/components/page-header';
import {
  fetchAdministrativePermissionGrants,
  fetchPermissionCatalog,
  getSession,
} from '@/lib/api';
import { canManageAdministrativePermissionsUi } from '@/lib/stage1-identity';

export const metadata: Metadata = {
  title: 'Permisos',
  robots: { index: false, follow: false },
};

export default async function PermissionsPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const canManage = canManageAdministrativePermissionsUi(user.role);

  if (!canManage) {
    return (
      <>
        <PageHeader
          title="Permisos"
          intro="Gestión de grants del rol administrativo."
        />
        <p role="alert" className="text-sm text-danger">
          Esta pantalla es solo para dirección y administración técnica. Tu rol
          no gestiona permisos administrativos.
        </p>
        <p className="mt-8 text-sm text-ink-muted">
          <Link href="/dashboard" className="underline">
            Volver al panel
          </Link>
        </p>
      </>
    );
  }

  const [catalog, grants] = await Promise.all([
    fetchPermissionCatalog(),
    fetchAdministrativePermissionGrants(),
  ]);

  const loadError = !catalog.ok
    ? catalog.message
    : !grants.ok
      ? grants.message
      : null;

  return (
    <>
      <PageHeader
        title="Permisos"
        intro="Catálogo y grants del rol ADMINISTRATIVE. La API es la autoridad; esta UI solo refleja y muta vía endpoints existentes."
      />

      {loadError ? (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      ) : catalog.ok && grants.ok && catalog.permissions.length === 0 ? (
        <p className="text-sm text-ink-muted">El catálogo de permisos está vacío.</p>
      ) : catalog.ok && grants.ok ? (
        <AdministrativePermissionsPanel
          catalog={catalog.permissions}
          grants={grants.permissions}
          canUpdate
        />
      ) : null}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
        {' · '}
        <Link href="/dashboard/administratives" className="underline">
          Administrativos
        </Link>
      </p>
    </>
  );
}
