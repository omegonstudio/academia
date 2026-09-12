/**
 * Executable wrapper for the SuperAdmin bootstrap.
 *
 * Invoked by the container entrypoint after migrations have been applied.
 * Separated from `bootstrap.ts` so importing the logic never starts a process
 * or opens a connection.
 */
import { parseEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { createPrismaClient } from '../lib/prisma.js';
import { bootstrapSuperAdmin } from './bootstrap.js';

async function main(): Promise<void> {
  const env = parseEnv();
  const database = createPrismaClient(env.DATABASE_URL);

  try {
    await bootstrapSuperAdmin(database, {
      email: env.SUPERADMIN_EMAIL,
      password: env.SUPERADMIN_PASSWORD,
    });
  } finally {
    await database.$disconnect();
  }
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'SuperAdmin bootstrap failed');
  process.exit(1);
});
