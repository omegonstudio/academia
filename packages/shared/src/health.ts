import { z } from 'zod';

/**
 * Health contract.
 *
 * `ok`       — the application and all its dependencies are usable.
 * `degraded` — the process is up but a dependency or its configuration is not.
 *
 * The payload is intentionally coarse: it must be safe to expose publicly, so
 * it never contains connection strings, hostnames, credentials or stack traces.
 */
export const healthCheckStatusSchema = z.enum(['pass', 'fail']);

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  environment: z.string(),
  uptimeSeconds: z.number(),
  checks: z.object({
    configuration: healthCheckStatusSchema,
    database: healthCheckStatusSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
