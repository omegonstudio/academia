import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRuntimeApp } from './create-runtime-app.js';
import { logger } from './lib/logger.js';

const SHUTDOWN_GRACE_MS = 10_000;

const runtimePromise = createRuntimeApp();

/**
 * Vercel Fluid / Express detection: default export is the request listener.
 * Boot (env, Prisma, identity bootstrap) runs once per warm instance.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { app } = await runtimePromise;
  app(req, res);
}

/**
 * Docker / local long-running process. Skipped on Vercel where the platform
 * invokes the default export per request.
 */
async function listenLocally(): Promise<void> {
  const { app, database, env, googleMeetConfigured, zoomConfigured } =
    await runtimePromise;

  const server = app.listen(env.API_PORT, () => {
    logger.info(
      {
        port: env.API_PORT,
        environment: env.NODE_ENV,
        googleMeetConfigured,
        zoomConfigured,
      },
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

if (!process.env['VERCEL']) {
  listenLocally().catch((error: unknown) => {
    logger.fatal({ err: error }, 'API failed to start');
    process.exit(1);
  });
}
