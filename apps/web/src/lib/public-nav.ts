/**
 * Public marketing navigation for Academia / Spanish2Go offer.
 * Paths are crawlable SEO routes (see `lib/site.ts` → `publicRoutes`).
 */
export const publicNavLinks = [
  { href: '/profesores-no-nativos', label: 'Profesores no nativos' },
  { href: '/cursos', label: 'Cursos online' },
  { href: '/pildoras-educativas', label: 'Píldoras educativas' },
  { href: '/mentorias', label: 'Mentorías individuales' },
  { href: '/blabla2go', label: 'Blabla2Go' },
] as const

export const publicCta = {
  href: '/asesoria',
  label: 'Agendá una asesoría gratis',
} as const
