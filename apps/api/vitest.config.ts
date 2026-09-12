import { defineConfig } from 'vitest/config';

/**
 * Unit suite: no database, no network, no container.
 * Integration tests live in vitest.integration.config.ts.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', '**/node_modules/**'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
  },
});
