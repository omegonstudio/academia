import type { Env } from './env.js';

/**
 * Whether OpenAPI + Swagger UI are mounted.
 *
 * - Explicit `API_DOCS_ENABLED=true|false` always wins.
 * - When unset: enabled outside production, disabled in production.
 */
export function isApiDocsEnabled(env: Pick<Env, 'NODE_ENV' | 'API_DOCS_ENABLED'>): boolean {
  if (env.API_DOCS_ENABLED !== undefined) {
    return env.API_DOCS_ENABLED;
  }
  return env.NODE_ENV !== 'production';
}
