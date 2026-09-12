import { sessionResponseSchema, type SessionUser } from '@academia/shared';
import { cookies } from 'next/headers';

/**
 * Server-side address of the API. Distinct from the browser path (`/api`),
 * which the Next.js rewrite proxies here.
 */
const apiInternalUrl =
  process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';

/**
 * Resolves the current session by asking the API.
 *
 * Authorization is never inferred from the presence of a cookie: the API
 * verifies the signature and reloads the user, so a revoked account stops
 * resolving immediately. Returns null on any failure — an unreachable API means
 * "not authenticated", never "assume authenticated".
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${apiInternalUrl}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const parsed = sessionResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.user : null;
  } catch {
    return null;
  }
}
