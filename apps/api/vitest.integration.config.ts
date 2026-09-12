import { defineConfig } from 'vitest/config';

/**
 * Integration suite: requires a reachable PostgreSQL with migrations applied.
 * DATABASE_URL must point at a disposable database, never at production.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**'],
    // Shared database rows make parallel files unsafe.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
  },
});
