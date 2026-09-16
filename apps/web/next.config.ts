import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * The browser never talks to the API directly: `/api/*` is proxied to the API
 * service from the Next.js server. That keeps requests same-origin, so the
 * session cookie needs no cross-site relaxation and CORS stays unnecessary.
 */
const apiInternalUrl = process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the production image.
  output: 'standalone',
  // Workspace packages live outside apps/web, so tracing starts at the repo root.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow `/api/docs/` to keep its trailing slash (Swagger relative assets need it).
  skipTrailingSlashRedirect: true,

  async rewrites() {
    return [
      {
        source: '/api/docs',
        destination: `${apiInternalUrl}/docs/`,
      },
      {
        source: '/api/docs/',
        destination: `${apiInternalUrl}/docs/`,
      },
      {
        source: '/api/docs/:path*',
        destination: `${apiInternalUrl}/docs/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${apiInternalUrl}/:path*`,
      },
    ];
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
