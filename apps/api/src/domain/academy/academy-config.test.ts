import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACADEMY_TIMEZONE,
  ianaTimeZoneSchema,
  isIanaTimeZone,
  weekdayFromCivilDate,
  zonedLocalDateTimeToUtc,
} from '@academia/shared';
import { parseEnv, type Env } from '../../config/env.js';
import { getAcademyBusinessConfig } from './academy-config.js';

const VALID_SECRET = 'a'.repeat(32);

function baseEnv(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgresql://user:pw@db:5432/academia_test?schema=public',
    AUTH_SECRET: VALID_SECRET,
  };
}

describe('IANA timezone validation', () => {
  it('accepts the default academy timezone and other Area/Location ids', () => {
    expect(DEFAULT_ACADEMY_TIMEZONE).toBe('America/Argentina/Buenos_Aires');
    expect(isIanaTimeZone(DEFAULT_ACADEMY_TIMEZONE)).toBe(true);
    expect(isIanaTimeZone('America/Buenos_Aires')).toBe(true);
    expect(ianaTimeZoneSchema.safeParse(DEFAULT_ACADEMY_TIMEZONE).success).toBe(
      true,
    );
  });

  it('rejects offsets, empty values and unknown zones', () => {
    expect(isIanaTimeZone('-03:00')).toBe(false);
    expect(isIanaTimeZone('+00:00')).toBe(false);
    expect(isIanaTimeZone('Not/AZone')).toBe(false);
    expect(isIanaTimeZone('')).toBe(false);
    expect(isIanaTimeZone(null)).toBe(false);
    expect(isIanaTimeZone('UTC')).toBe(false);
    expect(ianaTimeZoneSchema.safeParse('-03:00').success).toBe(false);
    expect(ianaTimeZoneSchema.safeParse('GMT').success).toBe(false);
  });

  it('does not depend on process.env.TZ for acceptance', () => {
    const previous = process.env['TZ'];
    process.env['TZ'] = 'Pacific/Auckland';
    try {
      expect(isIanaTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
      expect(isIanaTimeZone('-03:00')).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env['TZ'];
      } else {
        process.env['TZ'] = previous;
      }
    }
  });

  it('converts academy local wall time to an absolute instant', () => {
    expect(weekdayFromCivilDate('2026-09-21')).toBe('MONDAY');
    expect(
      zonedLocalDateTimeToUtc(
        '2026-09-21',
        '18:00',
        'America/Argentina/Buenos_Aires',
      ).toISOString(),
    ).toBe('2026-09-21T21:00:00.000Z');
  });
});

describe('getAcademyBusinessConfig', () => {
  it('defaults to America/Argentina/Buenos_Aires from configuration', () => {
    const env = parseEnv(baseEnv());
    expect(env.ACADEMY_TIMEZONE).toBe(DEFAULT_ACADEMY_TIMEZONE);
    expect(getAcademyBusinessConfig(env).businessTimezone).toBe(
      'America/Argentina/Buenos_Aires',
    );
  });

  it('reads an explicit ACADEMY_TIMEZONE override', () => {
    const env = parseEnv({
      ...baseEnv(),
      ACADEMY_TIMEZONE: 'America/Santiago',
    });
    expect(getAcademyBusinessConfig(env).businessTimezone).toBe(
      'America/Santiago',
    );
  });

  it('rejects invalid ACADEMY_TIMEZONE at parse time', () => {
    expect(() =>
      parseEnv({ ...baseEnv(), ACADEMY_TIMEZONE: '-03:00' }),
    ).toThrow(/ACADEMY_TIMEZONE/);
    expect(() =>
      parseEnv({ ...baseEnv(), ACADEMY_TIMEZONE: 'Not/AZone' }),
    ).toThrow(/ACADEMY_TIMEZONE/);
  });

  it('uses the supplied Env object, not process timezone', () => {
    const previous = process.env['TZ'];
    process.env['TZ'] = 'Asia/Tokyo';
    try {
      const env = {
        ...parseEnv(baseEnv()),
        ACADEMY_TIMEZONE: 'America/Argentina/Buenos_Aires',
      } satisfies Env;
      expect(getAcademyBusinessConfig(env).businessTimezone).toBe(
        'America/Argentina/Buenos_Aires',
      );
    } finally {
      if (previous === undefined) {
        delete process.env['TZ'];
      } else {
        process.env['TZ'] = previous;
      }
    }
  });
});
