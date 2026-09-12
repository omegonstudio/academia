import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export type Database = PrismaClient;

/**
 * Prisma 7 no longer reads the connection string from the schema, so the URL is
 * always supplied explicitly through the pg driver adapter.
 */
export function createPrismaClient(connectionString: string): Database {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

/**
 * Liveness probe for the database.
 *
 * Swallows the driver error on purpose: `/health` reports a boolean and must
 * not leak a connection string or driver internals to an unauthenticated
 * caller. The failure is logged by the caller instead.
 */
export async function isDatabaseReachable(database: Database): Promise<boolean> {
  try {
    await database.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
