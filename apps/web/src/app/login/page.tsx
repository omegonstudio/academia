import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Ingresar',
  description: 'Acceso al panel de la academia.',
  // A credential screen carries no search value and must stay out of the index.
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Already-authenticated visitors skip the form.
  if (await getSession()) redirect('/dashboard');

  return (
    <>
      <PageHeader
        title="Ingresar"
        intro="Accedé con la cuenta que te asignó la academia."
      />
      <LoginForm />
    </>
  );
}
