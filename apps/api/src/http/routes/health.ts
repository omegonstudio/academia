import type { HealthResponse } from '@academia/shared';
import { Router } from 'express';

export interface HealthDependencies {
  environment: string;
  /** Resolves false when the database cannot serve a trivial query. */
  isDatabaseReachable: () => Promise<boolean>;
  /** Non-empty when a cross-field configuration invariant is violated. */
  configurationIssues: () => string[];
  uptimeSeconds: () => number;
}

/**
 * `GET /health`
 *
 * Answers 200 when everything is usable and 503 otherwise, so container and
 * deployment probes can rely on the status code alone. The body distinguishes a
 * database outage from a configuration problem without exposing hostnames,
 * connection strings or the nature of the misconfiguration.
 */
export function createHealthRouter(deps: HealthDependencies): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    void (async () => {
      const [databaseReachable, issues] = [
        await deps.isDatabaseReachable(),
        deps.configurationIssues(),
      ];

      const body: HealthResponse = {
        status: databaseReachable && issues.length === 0 ? 'ok' : 'degraded',
        service: 'academia-api',
        environment: deps.environment,
        uptimeSeconds: deps.uptimeSeconds(),
        checks: {
          configuration: issues.length === 0 ? 'pass' : 'fail',
          database: databaseReachable ? 'pass' : 'fail',
        },
      };

      res.status(body.status === 'ok' ? 200 : 503).json(body);
    })();
  });

  return router;
}
