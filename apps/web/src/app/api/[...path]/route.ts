import {
  apiInternalBaseUrl,
  forwardRequestHeaders,
  forwardResponseHeaders,
  upstreamApiPath,
} from '@/lib/api-proxy';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

/**
 * Same-origin browser proxy to the API.
 *
 * Uses `API_INTERNAL_URL` at request time so Docker Compose and hosted DEV
 * (Vercel web → API DEV) resolve the upstream correctly. Build-time Next
 * rewrites cannot see runtime-only environment variables.
 */
async function proxy(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  const target = new URL(
    upstreamApiPath(path),
    ensureTrailingSlash(apiInternalBaseUrl()),
  );
  target.search = request.nextUrl.search;

  const init: RequestInit = {
    method: request.method,
    headers: forwardRequestHeaders(request.headers),
    redirect: 'manual',
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    // Required when streaming a Request body with fetch in Node.
    Object.assign(init, { duplex: 'half' });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { error: 'api_unreachable' },
      { status: 502 },
    );
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardResponseHeaders(upstream.headers),
  });
}

function ensureTrailingSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
