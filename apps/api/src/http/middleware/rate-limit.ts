import type { RequestHandler } from 'express';
import { TooManyRequestsError } from '../errors.js';

export interface RateLimitOptions {
  windowMs: number;
  maxAttempts: number;
  /** Defaults to the socket address; overridable for testing. */
  keyOf?: (ip: string) => string;
}

/**
 * Fixed-window throttle for unauthenticated write endpoints.
 *
 * State is per-process and in-memory, which is enough to blunt credential
 * stuffing against a single API container. A shared store is required before
 * running more than one replica — tracked as a Stage 9 hardening task.
 */
export function rateLimit({
  windowMs,
  maxAttempts,
  keyOf = (ip) => ip,
}: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, _res, next) => {
    const now = Date.now();
    const key = keyOf(req.ip ?? 'unknown');

    // Opportunistic sweep keeps the map from growing without bound.
    if (hits.size > 10_000) {
      for (const [entryKey, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(entryKey);
      }
    }

    const existing = hits.get(key);

    if (!existing || existing.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    existing.count += 1;

    if (existing.count > maxAttempts) {
      next(new TooManyRequestsError());
      return;
    }

    next();
  };
}
