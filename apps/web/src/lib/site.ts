/**
 * Canonical site identity. Metadata, sitemap and robots all derive from here so
 * the public origin is configured in exactly one place.
 */
const DEFAULT_URL = 'http://localhost:3000';

export const site = {
  name: 'Academia de Español — Omegon',
  shortName: 'Academia',
  description:
    'Academia de español con clases individuales y grupales, docentes formados y seguimiento personalizado.',
  locale: 'es_AR',
  url: process.env['NEXT_PUBLIC_APP_URL'] ?? DEFAULT_URL,
} as const;

/** Public, indexable routes. Private areas are deliberately excluded. */
export const publicRoutes = [
  { path: '/', changeFrequency: 'monthly', priority: 1 },
  { path: '/about', changeFrequency: 'yearly', priority: 0.8 },
  { path: '/courses', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/teachers', changeFrequency: 'yearly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.6 },
] as const;

/** Routes that must never be indexed. */
export const privateRoutePrefixes = ['/dashboard', '/login', '/api'] as const;
