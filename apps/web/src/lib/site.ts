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
 * Public, indexable routes. Product decision (Fase 4): keep the one-page
 * landing. Legacy `/about|/courses|/teachers|/contact` stay folded into
 * `/#academia`, `/#cursos`, `/#contacto` (and método) — not restored as
 * separate crawlable pages.
 *
 * `/cursos` (catalog) and `/cursos/[slug]` are public LMS surfaces (not in
 * privateRoutePrefixes). Published slugs are appended dynamically in
 * `app/sitemap.ts` via `GET /public/online-courses`.
 */
export const publicRoutes = [
  { path: '/', changeFrequency: 'monthly' as const, priority: 1 },
  { path: '/cursos', changeFrequency: 'weekly' as const, priority: 0.8 },
] as const;

/** Routes that must never be indexed. */
export const privateRoutePrefixes = [
  '/dashboard',
  '/login',
  '/design-system',
  '/api',
] as const;

/**
 * Fetch published online-course slugs for the sitemap.
 * Returns [] when the API is unreachable (build without API, offline, etc.).
 */
export async function listPublishedOnlineCourseSlugs(): Promise<string[]> {
  const base =
    process.env['API_INTERNAL_URL']?.replace(/\/$/, '') ??
    'http://localhost:4000';
  try {
    const response = await fetch(`${base}/public/online-courses`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const body: unknown = await response.json();
    if (
      !body ||
      typeof body !== 'object' ||
      !('courses' in body) ||
      !Array.isArray((body as { courses: unknown }).courses)
    ) {
      return [];
    }
    const slugs: string[] = [];
    for (const course of (body as { courses: unknown[] }).courses) {
      if (
        course &&
        typeof course === 'object' &&
        'slug' in course &&
        typeof (course as { slug: unknown }).slug === 'string' &&
        (course as { slug: string }).slug.trim().length > 0
      ) {
        slugs.push((course as { slug: string }).slug.trim());
      }
    }
    return slugs;
  } catch {
    return [];
  }
}
