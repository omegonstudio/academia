import type { Logger } from 'pino';

/**
 * Optional Sentry bootstrap via dynamic import so the dependency is not required
 * at build time when SENTRY_DSN is unset.
 */
export async function initSentryIfConfigured(options: {
  dsn: string;
  environment: string;
  logger: Logger;
}): Promise<void> {
  if (!options.dsn) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: options.dsn,
      environment: options.environment,
      tracesSampleRate: 0.1,
    });
    options.logger.info('Sentry initialized');
  } catch (error) {
    options.logger.warn(
      { err: error },
      'SENTRY_DSN set but @sentry/node is not installed; continuing without it',
    );
  }
}
