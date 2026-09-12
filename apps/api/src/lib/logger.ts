import { pino, type Logger, type LoggerOptions } from 'pino';

/**
 * Field paths stripped from every log line.
 *
 * Logging is deliberately not coupled to the validated environment: the logger
 * has to be usable to report an invalid environment.
 */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  '*.*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'AUTH_SECRET',
  'DATABASE_URL',
  'SUPERADMIN_PASSWORD',
];

const VALID_LEVELS = new Set([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);

function resolveLevel(): string {
  const configured = process.env['LOG_LEVEL'];
  if (configured && VALID_LEVELS.has(configured)) return configured;
  return process.env['NODE_ENV'] === 'test' ? 'silent' : 'info';
}

export function createLogger(overrides: LoggerOptions = {}): Logger {
  return pino({
    level: resolveLevel(),
    base: { service: 'academia-api' },
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    formatters: {
      level: (label) => ({ level: label }),
    },
    ...overrides,
  });
}

export const logger = createLogger();
