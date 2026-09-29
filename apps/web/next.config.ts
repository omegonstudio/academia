import path from 'node:path';
import type { NextConfig } from 'next';

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
  transpilePackages: ['@academia/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow `/api/docs/` to keep its trailing slash (Swagger relative assets need it).
  skipTrailingSlashRedirect: true,
  // Static assets from academia-front (icons/placeholders); no remote image CDN yet.
  images: {
    unoptimized: true,
  },

  // Browser `/api/*` is proxied at request time by `app/api/[...path]/route.ts`
  // using `API_INTERNAL_URL`. That keeps Docker and Vercel service bindings
  // working — build-time rewrites cannot see Vercel bindings.

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
