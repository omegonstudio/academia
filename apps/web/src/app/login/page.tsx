import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { getSession } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Ingresar',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getSession()
  if (user) {
    const params = await searchParams
    const next = params.next
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      redirect(next)
    }
    redirect('/dashboard')
  }
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
