import type { RequestHandler } from 'express';

/**
 * Origin allowlist for direct browser calls.
 *
 * In the default topology the browser talks to the API through the Next.js
 * proxy, so requests are same-origin and no allowlist is needed. This exists
 * for deployments that expose the API on its own hostname.
 *
 * A wildcard origin is never emitted: responses carry credentials.
 */
export function cors(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins.filter(Boolean));

  return (req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

export function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
