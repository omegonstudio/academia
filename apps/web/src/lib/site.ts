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

/**
 * Public, indexable routes after Phase 1 UI swap (landing one-page).
 * Legacy `/about|/courses|/teachers|/contact` pages were removed with the
 * academia-front shell; anchors live on `/` until product decides otherwise.
 */
export const publicRoutes = [
  { path: '/', changeFrequency: 'monthly' as const, priority: 1 },
] as const;

/** Routes that must never be indexed. */
export const privateRoutePrefixes = [
  '/dashboard',
  '/login',
  '/design-system',
  '/api',
] as const;
