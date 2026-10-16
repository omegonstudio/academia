import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cursos online — Academia',
  description:
    'Catálogo de cursos online asíncronos de la Academia de Español Omegon.',
}

export default function PublicOnlineCoursesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
