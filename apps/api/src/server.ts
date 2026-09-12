import { evaluateConfiguration, parseEnv } from './config/env.js';
import { createAuthService } from './domain/identity/auth-service.js';
import { createSessionCodec } from './domain/identity/session.js';
import { createUserRepository } from './domain/identity/user-repository.js';
import { createApp } from './http/app.js';
import { parseAllowedOrigins } from './http/middleware/cors.js';
import { createPrismaClient, isDatabaseReachable } from './lib/prisma.js';
import { logger } from './lib/logger.js';

const SHUTDOWN_GRACE_MS = 10_000;

async function main(): Promise<void> {
  const env = parseEnv();

  // A production process must not start misconfigured; in development the same
  // issues are surfaced as warnings so the loop stays fast.
  const issues = evaluateConfiguration(env);
  if (issues.length > 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error(`Refusing to start:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    }
    logger.warn({ issues }, 'Configuration issues detected');
  }

  const database = createPrismaClient(env.DATABASE_URL);
  const users = createUserRepository(database);
  const authService = createAuthService(users);
  const sessionCodec = createSessionCodec(env.AUTH_SECRET, env.AUTH_SESSION_TTL);
  const startedAt = Date.now();

  const app = createApp({
    logger,
    allowedOrigins: parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
    health: {
      environment: env.NODE_ENV,
      isDatabaseReachable: () => isDatabaseReachable(database),
      configurationIssues: () => evaluateConfiguration(env),
      uptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
    },
    auth: {
      authService,
      sessionCodec,
      cookie: {
        name: 'academia_session',
        secure: env.NODE_ENV === 'production',
        ttlSeconds: env.AUTH_SESSION_TTL,
      },
    },
  });

  const server = app.listen(env.API_PORT, () => {
    logger.info(
      { port: env.API_PORT, environment: env.NODE_ENV },
      'API listening',
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');

    const timer = setTimeout(() => {
      logger.error('Forced shutdown after grace period');
      process.exit(1);
    }, SHUTDOWN_GRACE_MS);
    timer.unref();

    server.close(() => {
      void database.$disconnect().then(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API failed to start');
  process.exit(1);
});
