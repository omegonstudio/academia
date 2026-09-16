import { z } from 'zod';
import {
  DEFAULT_ACADEMY_TIMEZONE,
  ianaTimeZoneSchema,
} from '@academia/shared';

/**
 * Environment contract for the API.
 *
 * Parsing is strict and happens once at boot: an invalid environment must stop
 * the process rather than surface later as a confusing runtime failure.
 *
 * Error messages reference variable NAMES only. Values are never echoed,
 * because this schema covers secrets.
 */
const booleanFromEnv = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

/**
 * Structural check on a connection string.
 *
 * Inside containers the URL is assembled with percent-encoding by
 * docker/database-url.mjs. This guards the hand-written cases — host tooling and
 * managed providers — where an unencoded password can either break the URL or,
 * worse, parse into a different host or credential without any error.
 *
 * Returns a description of the problem, or null when the URL is usable.
 */
export function describeDatabaseUrlProblem(raw: string): string | null {
  let parsed: URL;

  // `pg-connection-string`, which the Prisma driver adapter uses, parses with
  // WHATWG `new URL` and then percent-decodes each component. Validating the
  // same way therefore reproduces what the driver will accept.
  //
  // Verified against that parser: an unencoded "+", "=", "@" or ":" in the
  // password round-trips correctly and needs no special handling. An unencoded
  // "/" makes the URL unparseable, which is what a `openssl rand -base64`
  // password hits. A literal "%" must be written "%25", since the driver
  // decodes.
  try {
    parsed = new URL(raw);
  } catch {
    return (
      'DATABASE_URL is not a valid URL. A "/" in the password must be written ' +
      '%2F and a literal "%" must be written %25'
    );
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return 'DATABASE_URL must use the postgresql:// scheme';
  }

  if (!parsed.hostname) {
    return 'DATABASE_URL must include a host';
  }

  if (parsed.port !== '' && !/^[0-9]+$/.test(parsed.port)) {
    return 'DATABASE_URL has a non-numeric port';
  }

  return null;
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .superRefine((value, ctx) => {
      const problem = describeDatabaseUrlProblem(value);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    }),

  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters long'),
  AUTH_SESSION_TTL: z.coerce.number().int().positive().default(604_800),

  /** Comma-separated origins. Empty when the browser reaches the API through the web proxy. */
  CORS_ALLOWED_ORIGINS: z.string().default(''),

  SUPERADMIN_EMAIL: z.email().default('omegon.info@gmail.com'),
  /** Absent means "do not bootstrap"; it must never fail a deployment. */
  SUPERADMIN_PASSWORD: z.string().min(12).optional(),

  LOAD_SEED_DATA: booleanFromEnv,

  /**
   * OpenAPI + Swagger UI gate.
   *
   * Optional: when unset, docs are enabled outside production and disabled in
   * production (`isApiDocsEnabled`). Set explicitly to force either state.
   */
  API_DOCS_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === 'true',
    ),

  /**
   * Academy business IANA timezone. Configuration — not class-generation logic.
   * ScheduleOption local times convert to ClassSession timestamptz via this value.
   */
  ACADEMY_TIMEZONE: ianaTimeZoneSchema.default(DEFAULT_ACADEMY_TIMEZONE),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Secrets that must never reach a production deployment. The sample value in
 * `.env.example` is included so a copied template cannot be promoted silently.
 */
const REJECTED_PRODUCTION_SECRETS = new Set([
  'development-only-secret-change-me-32-chars-min',
]);

/**
 * Invariants that depend on more than one variable.
 *
 * Shared by boot (fail fast) and `/health` (report `configuration: fail`) so a
 * single definition backs both, and an operator can tell a misconfiguration
 * apart from a database outage.
 */
export function evaluateConfiguration(env: Env): string[] {
  const issues: string[] = [];

  if (env.NODE_ENV === 'production') {
    if (REJECTED_PRODUCTION_SECRETS.has(env.AUTH_SECRET)) {
      issues.push('AUTH_SECRET still holds the development sample value');
    }
    if (env.LOAD_SEED_DATA) {
      issues.push('LOAD_SEED_DATA must be false in production');
    }
  }

  return issues;
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

let cached: Env | undefined;

/** Memoised accessor so modules share one validated environment. */
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}
