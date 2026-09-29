/**
 * Maps the public browser path under `/api/*` to the Express path on the API.
 *
 * Express mounts routes at the root (`/auth`, `/docs`, …), not under `/api`.
 * Swagger needs a trailing slash on `/docs/` so relative assets resolve.
 */
export function upstreamApiPath(segments: readonly string[]): string {
  if (segments.length === 0) {
    return '/';
  }

  if (segments[0] === 'docs') {
    const rest = segments.slice(1).join('/');
    return rest.length > 0 ? `/docs/${rest}` : '/docs/';
  }

  return `/${segments.join('/')}`;
}

export function apiInternalBaseUrl(): string {
  return process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';
}

const HOP_BY_HOP_REQUEST = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const HOP_BY_HOP_RESPONSE = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export function forwardRequestHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

export function forwardResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP_RESPONSE.has(key.toLowerCase())) {
      headers.append(key, value);
    }
  });
  return headers;
}
