import { z } from 'zod';
import {
  DEFAULT_ACADEMY_TIMEZONE,
  MATERIAL_DEFAULT_MAX_AUDIO_BYTES,
  MATERIAL_DEFAULT_MAX_IMAGE_BYTES,
  MATERIAL_DEFAULT_MAX_PDF_BYTES,
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

  /** Academy director (operational). Distinct from technical SUPER_ADMIN. */
  DIRECTOR_EMAIL: z.email().default('saragarfu@gmail.com'),
  /** Absent means "do not bootstrap"; it must never fail a deployment. */
  DIRECTOR_PASSWORD: z.string().min(12).optional(),

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

  // -------------------------------------------------------------------------
  // Object storage (S3-compatible: MinIO in development, Spaces in production)
  // Optional as a set: all empty → in-memory stubs (hosted DEV without materials).
  // -------------------------------------------------------------------------
  S3_ENDPOINT: z
    .string()
    .default('')
    .superRefine((value, ctx) => {
      if (value.length === 0) return;
      try {
        void new URL(value);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'S3_ENDPOINT must be a URL' });
      }
    }),
  /**
   * Optional browser/host-facing endpoint for presigned URLs.
   * In Compose, the API talks to MinIO as `http://minio:9000` while the host
   * browser must use `http://127.0.0.1:9000`. When unset, signed URLs use
   * S3_ENDPOINT (correct for DigitalOcean Spaces).
   */
  S3_PUBLIC_ENDPOINT: z
    .string()
    .default('')
    .superRefine((value, ctx) => {
      if (value.length === 0) return;
      try {
        void new URL(value);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'S3_PUBLIC_ENDPOINT must be a URL',
        });
      }
    }),
  S3_BUCKET: z.string().default(''),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_FORCE_PATH_STYLE: booleanFromEnv,

  MATERIAL_MAX_PDF_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(MATERIAL_DEFAULT_MAX_PDF_BYTES),
  MATERIAL_MAX_IMAGE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(MATERIAL_DEFAULT_MAX_IMAGE_BYTES),
  MATERIAL_MAX_AUDIO_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(MATERIAL_DEFAULT_MAX_AUDIO_BYTES),
  MATERIAL_UPLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  MATERIAL_DOWNLOAD_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(120),

  // -------------------------------------------------------------------------
  // Notifications (Resend + in-app)
  // -------------------------------------------------------------------------
  NOTIFICATIONS_ENABLED: booleanFromEnv,
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default(''),
  /** Public web origin for email links and checkout back_urls. */
  APP_PUBLIC_URL: z.string().default(''),
  /**
   * Public API origin for Mercado Pago `notification_url` (ngrok / ingress).
   * Example: `https://abc.ngrok-free.app` → webhook
   * `/finance/webhooks/mercado-pago`. Do not point at PostgreSQL.
   */
  API_PUBLIC_URL: z.string().default(''),

  // -------------------------------------------------------------------------
  // Google Meet (Calendar API) — optional; empty disables createGoogleMeet
  // -------------------------------------------------------------------------
  GOOGLE_MEET_CLIENT_ID: z.string().default(''),
  GOOGLE_MEET_CLIENT_SECRET: z.string().default(''),
  GOOGLE_MEET_REFRESH_TOKEN: z.string().default(''),
  /** Calendar that owns Meet events. Defaults to `primary` when Meet is on. */
  GOOGLE_MEET_CALENDAR_ID: z.string().default(''),

  // -------------------------------------------------------------------------
  // Zoom Meetings (Server-to-Server OAuth) — optional; empty disables Zoom
  // -------------------------------------------------------------------------
  ZOOM_ACCOUNT_ID: z.string().default(''),
  ZOOM_CLIENT_ID: z.string().default(''),
  ZOOM_CLIENT_SECRET: z.string().default(''),
  /** Zoom user id or email of the academy host that owns meetings. */
  ZOOM_HOST_USER_ID: z.string().default(''),

  // -------------------------------------------------------------------------
  // Payments (empty → stub providers; set for live/sandbox)
  // -------------------------------------------------------------------------
  MERCADOPAGO_ACCESS_TOKEN: z.string().default(''),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().default(''),
  /**
   * Explicit opt-in to use a live (APP_USR) Mercado Pago token while
   * NODE_ENV !== production. Default false — sandbox must use TEST- tokens.
   */
  MERCADOPAGO_ALLOW_LIVE_IN_DEV: booleanFromEnv,
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),

  /** Optional Sentry DSN; empty disables. */
  SENTRY_DSN: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

/**
 * True when the four required S3 fields are all non-empty.
 * Partial configuration is rejected by `evaluateConfiguration`.
 */
export function isObjectStorageConfigured(env: Env): boolean {
  return (
    env.S3_ENDPOINT.length > 0 &&
    env.S3_BUCKET.length > 0 &&
    env.S3_ACCESS_KEY.length > 0 &&
    env.S3_SECRET_KEY.length > 0
  );
}

function objectStorageFieldCount(env: Env): number {
  return [
    env.S3_ENDPOINT,
    env.S3_BUCKET,
    env.S3_ACCESS_KEY,
    env.S3_SECRET_KEY,
  ].filter((value) => value.length > 0).length;
}

/**
 * Secrets that must never reach a production deployment. The sample value in
 * `.env.example` is included so a copied template cannot be promoted silently.
 */
const REJECTED_PRODUCTION_SECRETS = new Set([
  'development-only-secret-change-me-32-chars-min',
]);

/** Development MinIO sample keys — must never ship to production Spaces. */
const REJECTED_PRODUCTION_S3_KEYS = new Set([
  'academia-dev-access-key',
  'academia-dev-secret-key',
  'minioadmin',
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

  const s3FieldsSet = objectStorageFieldCount(env);
  if (s3FieldsSet > 0 && s3FieldsSet < 4) {
    issues.push(
      'Object storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY together (or all empty)',
    );
  }

  if (env.NODE_ENV === 'production') {
    if (REJECTED_PRODUCTION_SECRETS.has(env.AUTH_SECRET)) {
      issues.push('AUTH_SECRET still holds the development sample value');
    }
    if (env.LOAD_SEED_DATA) {
      issues.push('LOAD_SEED_DATA must be false in production');
    }
    if (
      isObjectStorageConfigured(env) &&
      (REJECTED_PRODUCTION_S3_KEYS.has(env.S3_ACCESS_KEY) ||
        REJECTED_PRODUCTION_S3_KEYS.has(env.S3_SECRET_KEY))
    ) {
      issues.push('S3 credentials still hold development sample values');
    }
    if (
      env.STRIPE_SECRET_KEY.length > 0 &&
      (env.STRIPE_SECRET_KEY.startsWith('sk_test_') ||
        env.STRIPE_SECRET_KEY.includes('stub'))
    ) {
      issues.push('STRIPE_SECRET_KEY must be a live key in production');
    }
    if (
      env.MERCADOPAGO_ACCESS_TOKEN.length > 0 &&
      /TEST|sandbox|stub/i.test(env.MERCADOPAGO_ACCESS_TOKEN)
    ) {
      issues.push(
        'MERCADOPAGO_ACCESS_TOKEN looks like a sandbox/test token in production',
      );
    }
    if (
      env.MERCADOPAGO_ACCESS_TOKEN.length > 0 &&
      env.MERCADOPAGO_WEBHOOK_SECRET.length === 0
    ) {
      issues.push(
        'MERCADOPAGO_WEBHOOK_SECRET is required when Mercado Pago is enabled in production',
      );
    }
  }

  if (
    env.NOTIFICATIONS_ENABLED &&
    env.NODE_ENV === 'production' &&
    (env.RESEND_API_KEY.length === 0 || env.RESEND_FROM_EMAIL.length === 0)
  ) {
    issues.push(
      'NOTIFICATIONS_ENABLED requires RESEND_API_KEY and RESEND_FROM_EMAIL',
    );
  }

  return issues;
}

/** Live Checkout Pro credentials start with APP_USR- and are not TEST-. */
export function looksLikeMercadoPagoLiveAccessToken(token: string): boolean {
  if (!token) return false;
  if (/^TEST-/i.test(token)) return false;
  return /^APP_USR-/i.test(token);
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
