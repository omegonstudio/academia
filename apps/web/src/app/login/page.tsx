import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { getSession } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Ingresar',
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  const user = await getSession()
  if (user) redirect('/dashboard')
  return <LoginForm />
}
