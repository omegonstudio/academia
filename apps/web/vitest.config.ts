import { defineConfig } from 'vitest/config';

/** Unit suite for web helpers (no browser, no Next server). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
