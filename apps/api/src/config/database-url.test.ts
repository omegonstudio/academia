import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseConnectionString } from 'pg-connection-string';
import { describe, expect, it } from 'vitest';

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../docker/database-url.mjs',
);

function buildUrl(env: Record<string, string>): string {
  return execFileSync(process.execPath, [script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  }).trim();
}

function buildUrlFailure(env: Record<string, string | undefined>): string {
  try {
    execFileSync(process.execPath, [script], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });
    throw new Error('expected database-url.mjs to exit non-zero');
  } catch (error) {
    const failure = error as { status?: number; stderr?: string };
    expect(failure.status).toBe(1);
    return failure.stderr ?? '';
  }
}

describe('docker/database-url.mjs', () => {
  const base = {
    POSTGRES_USER: 'academia',
    POSTGRES_PASSWORD: 'simple',
    POSTGRES_DB: 'academia_dev',
    POSTGRES_HOST: 'db',
    POSTGRES_PORT: '5432',
  };

  it.each([
    ['slash', 'a/b'],
    ['percent', 'a%b'],
    ['at', 'a@b'],
    ['colon', 'a:b'],
    ['plus', 'a+b'],
    ['equals', 'a=b'],
    ['space', 'a b'],
    ['combined hostile', 'p+a/s=w:d@x'],
    ['quotes and punctuation', `a"b'c?d#e&f`],
  ])('round-trips password with %s through pg-connection-string', (_label, password) => {
    const url = buildUrl({ ...base, POSTGRES_PASSWORD: password });
    const parsed = parseConnectionString(url);

    expect(parsed.password).toBe(password);
    expect(parsed.user).toBe('academia');
    expect(parsed.host).toBe('db');
    expect(String(parsed.port)).toBe('5432');
    expect(parsed.database).toBe('academia_dev');
  });

  it('percent-encodes the user and leaves a plain database name intact', () => {
    const url = buildUrl({
      ...base,
      POSTGRES_USER: 'u ser',
      POSTGRES_PASSWORD: 'p',
      POSTGRES_DB: 'academia_dev',
    });
    const parsed = parseConnectionString(url);

    expect(parsed.user).toBe('u ser');
    expect(parsed.database).toBe('academia_dev');
  });

  it('fails naming missing variables without printing any value', () => {
    const stderr = buildUrlFailure({
      POSTGRES_USER: 'academia',
      POSTGRES_PASSWORD: 'secret-must-not-leak',
      POSTGRES_DB: undefined,
    });

    expect(stderr).toMatch(/POSTGRES_DB/);
    expect(stderr).not.toContain('secret-must-not-leak');
  });

  it('rejects a non-numeric port', () => {
    const stderr = buildUrlFailure({ ...base, POSTGRES_PORT: '5432;rm' });
    expect(stderr).toMatch(/POSTGRES_PORT must be numeric/);
  });
});
