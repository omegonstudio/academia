import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Curso online — Academia',
  description: 'Curso online de la Academia de Español Omegon.',
}

export default function PublicOnlineCourseDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
