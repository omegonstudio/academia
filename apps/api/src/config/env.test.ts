import { describe, expect, it } from 'vitest';
import {
  describeDatabaseUrlProblem,
  evaluateConfiguration,
  parseEnv,
  type Env,
} from './env.js';

const VALID_SECRET = 'a'.repeat(32);

function baseEnv(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgresql://user:pw@db:5432/academia_test?schema=public',
    AUTH_SECRET: VALID_SECRET,
  };
}

describe('parseEnv', () => {
  it('applies documented defaults', () => {
    const env = parseEnv(baseEnv());

    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4000);
    expect(env.AUTH_SESSION_TTL).toBe(604_800);
    expect(env.LOAD_SEED_DATA).toBe(false);
    expect(env.SUPERADMIN_EMAIL).toBe('omegon.info@gmail.com');
    expect(env.ACADEMY_TIMEZONE).toBe('America/Argentina/Buenos_Aires');
    expect(env.API_DOCS_ENABLED).toBeUndefined();
  });

  it('parses an explicit API_DOCS_ENABLED flag', () => {
    expect(
      parseEnv({ ...baseEnv(), API_DOCS_ENABLED: 'true' }).API_DOCS_ENABLED,
    ).toBe(true);
    expect(
      parseEnv({ ...baseEnv(), API_DOCS_ENABLED: 'false' }).API_DOCS_ENABLED,
    ).toBe(false);
  });

  it('accepts an explicit ACADEMY_TIMEZONE override', () => {
    const env = parseEnv({
      ...baseEnv(),
      ACADEMY_TIMEZONE: 'America/Santiago',
    });
    expect(env.ACADEMY_TIMEZONE).toBe('America/Santiago');
  });

  it('rejects an invalid ACADEMY_TIMEZONE', () => {
    expect(() =>
      parseEnv({ ...baseEnv(), ACADEMY_TIMEZONE: '-03:00' }),
    ).toThrow(/ACADEMY_TIMEZONE/);
  });

  it('coerces numeric and boolean strings', () => {
    const env = parseEnv({
      ...baseEnv(),
      API_PORT: '8080',
      LOAD_SEED_DATA: 'true',
    });

    expect(env.API_PORT).toBe(8080);
    expect(env.LOAD_SEED_DATA).toBe(true);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({ AUTH_SECRET: VALID_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('rejects an AUTH_SECRET below 32 characters', () => {
    expect(() => parseEnv({ ...baseEnv(), AUTH_SECRET: 'short' })).toThrow(
      /AUTH_SECRET/,
    );
  });

  it('rejects an out-of-range port', () => {
    expect(() => parseEnv({ ...baseEnv(), API_PORT: '70000' })).toThrow(
      /API_PORT/,
    );
  });

  it('never includes a secret value in the error message', () => {
    const secret = 'super-secret-value-that-is-long-enough-x';

    try {
      parseEnv({ ...baseEnv(), AUTH_SECRET: secret, API_PORT: 'not-a-port' });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});

describe('describeDatabaseUrlProblem', () => {
  it.each([
    ['a plain URL', 'postgresql://user:abc123@db:5432/academia?schema=public'],
    ['the postgres:// alias', 'postgres://user:abc123@db:5432/academia'],
    ['no explicit port', 'postgresql://user:abc123@db/academia'],
    ['a percent-encoded password', 'postgresql://user:a%2Bb%3D%2Fc@db:5432/academia'],
    // Verified against pg-connection-string: these round-trip correctly
    // unencoded, so rejecting them would refuse a working connection string.
    ['an unencoded plus', 'postgresql://user:ab+cd@db:5432/academia'],
    ['an unencoded equals', 'postgresql://user:abcd==@db:5432/academia'],
  ])('accepts %s', (_label, url) => {
    expect(describeDatabaseUrlProblem(url)).toBeNull();
  });

  it('rejects an unencoded slash, which makes the URL unparseable', () => {
    expect(
      describeDatabaseUrlProblem('postgresql://user:ab/cd@db:5432/academia'),
    ).toMatch(/%2F/);
  });

  it('rejects a non-PostgreSQL scheme', () => {
    expect(describeDatabaseUrlProblem('mysql://user:pw@db:3306/academia')).toMatch(
      /postgresql/,
    );
  });

  it('rejects a URL with no host', () => {
    expect(describeDatabaseUrlProblem('postgresql:///academia')).toMatch(/host/);
  });

  it('is enforced by the environment schema', () => {
    expect(() =>
      parseEnv({
        AUTH_SECRET: VALID_SECRET,
        DATABASE_URL: 'postgresql://user:ab/cd@db:5432/academia',
      }),
    ).toThrow(/DATABASE_URL/);
  });
});

describe('evaluateConfiguration', () => {
  const productionEnv = (overrides: Partial<Env> = {}): Env => ({
    ...parseEnv({ ...baseEnv(), NODE_ENV: 'production' }),
    ...overrides,
  });

  it('accepts a valid production configuration', () => {
    expect(evaluateConfiguration(productionEnv())).toEqual([]);
  });

  it('flags the development sample secret in production', () => {
    const issues = evaluateConfiguration(
      productionEnv({
        AUTH_SECRET: 'development-only-secret-change-me-32-chars-min',
      }),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/AUTH_SECRET/);
  });

  it('flags development seed data in production', () => {
    const issues = evaluateConfiguration(productionEnv({ LOAD_SEED_DATA: true }));

    expect(issues).toContainEqual(expect.stringMatching(/LOAD_SEED_DATA/));
  });

  it('tolerates the sample secret outside production', () => {
    const env = parseEnv({
      ...baseEnv(),
      AUTH_SECRET: 'development-only-secret-change-me-32-chars-min',
    });

    expect(evaluateConfiguration(env)).toEqual([]);
  });
});
