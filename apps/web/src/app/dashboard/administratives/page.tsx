import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateAdministrativeForm } from '@/components/create-administrative-form';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/api';
import { canProvisionAdministrativeUi } from '@/lib/stage1-identity';

export const metadata: Metadata = {
  title: 'Administrativos',
  robots: { index: false, follow: false },
};

/**
 * Provision ADMINISTRATIVE users (POST /users/administratives).
 * There is no list endpoint in the API — UI is create-only by contract.
 */
export default async function AdministrativesPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const canProvision = canProvisionAdministrativeUi(user.role);

  return (
    <>
      <PageHeader
        title="Administrativos"
        intro="Aprovisionamiento de cuentas con rol administrativo. Los permisos se gestionan en Permisos."
      />

      <section
        aria-labelledby="admin-list-heading"
        className="max-w-2xl space-y-3"
      >
        <h2 id="admin-list-heading" className="text-lg font-semibold text-ink">
          Listado
        </h2>
        <p className="text-sm text-ink-muted" role="status">
          La API actual solo expone{' '}
          <code className="text-ink">POST /users/administratives</code>. No hay
          endpoint de listado de usuarios administrativos; por eso esta pantalla
          no inventa un directorio. Creá cuentas aquí y asigná grants en
          Permisos.
        </p>
      </section>

      {canProvision ? (
        <CreateAdministrativeForm />
      ) : (
        <p role="alert" className="mt-8 text-sm text-danger">
          No tenés autorización para aprovisionar administrativos. Solo
          dirección y administración técnica pueden hacerlo (la API valida{' '}
          <code className="text-ink">users.create</code>).
        </p>
      )}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
        {canProvision ? (
          <>
            {' · '}
            <Link href="/dashboard/permissions" className="underline">
              Gestionar permisos
            </Link>
          </>
        ) : null}
      </p>
    </>
  );
}
