/**
 * Startup configuration check.
 *
 * Run by the container entrypoint before migrations, so an invalid environment
 * fails immediately with an actionable message instead of being retried for a
 * minute as though the database were slow to start.
 *
 * Prints variable names and reasons only, never values.
 */
import { evaluateConfiguration, parseEnv } from './env.js';

function fail(message: string): never {
  process.stderr.write(`[preflight] ${message}\n`);
  process.exit(1);
}

try {
  const env = parseEnv();

  const issues = evaluateConfiguration(env);
  if (issues.length > 0 && env.NODE_ENV === 'production') {
    fail(
      `refusing to start in production:\n${issues
        .map((issue) => `  - ${issue}`)
        .join('\n')}`,
    );
  }

  for (const issue of issues) {
    process.stderr.write(`[preflight] warning: ${issue}\n`);
  }

  process.stdout.write(`[preflight] configuration valid (${env.NODE_ENV})\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
