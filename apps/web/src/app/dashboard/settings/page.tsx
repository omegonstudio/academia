import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/api';
import {
  canManageAdministrativePermissionsUi,
  canProvisionAdministrativeUi,
} from '@/lib/stage1-identity';
import { roleLabel } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'Configuración',
  robots: { index: false, follow: false },
};

/**
 * Stage 1 settings surface: session/identity context only.
 * No academyPercentage / payments APIs exist yet — those belong to Stage 6.
 */
export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const showAdminLinks =
    canManageAdministrativePermissionsUi(user.role) ||
    canProvisionAdministrativeUi(user.role);

  return (
    <>
      <PageHeader
        title="Configuración"
        intro="Datos de tu sesión e identidad. La configuración financiera de la academia llegará en una etapa posterior."
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
        aria-labelledby="settings-stage1-heading"
        className="mt-8 max-w-2xl space-y-3"
      >
        <h2
          id="settings-stage1-heading"
          className="text-lg font-semibold text-ink"
        >
          Identidad y acceso (Stage 1)
        </h2>
        <p className="text-sm text-ink-muted">
          No hay endpoints de configuración editable en Stage 1. Esta pantalla
          resume tu sesión verificada por el servidor (
          <code className="text-ink">GET /auth/me</code>
          ). Ajustes como el porcentaje de la academia o medios de pago no están
          implementados y no se inventan aquí.
        </p>
        {showAdminLinks ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink">
            <li>
              <Link href="/dashboard/administratives" className="underline">
                Aprovisionar administrativos
              </Link>
            </li>
            <li>
              <Link href="/dashboard/permissions" className="underline">
                Permisos del rol administrativo
              </Link>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            La dirección gestiona permisos administrativos y el aprovisionamiento
            de personal desde sus propias pantallas.
          </p>
        )}
      </section>

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </>
  );
}
