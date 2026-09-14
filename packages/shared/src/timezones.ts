import { z } from 'zod';

/**
 * Default academy business timezone (IANA).
 * Configuration may override via env; domain must not hardcode this string.
 */
export const DEFAULT_ACADEMY_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Validates an IANA time zone id without reading process.env.TZ or the host locale.
 * Rejects fixed offsets (`-03:00`) and names without an Area/Location form.
 */
export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  if (/^[+-]\d{2}(:\d{2})?$/.test(value)) {
    return false;
  }
  if (!value.includes('/')) {
    return false;
  }
  try {
    // RangeError for unknown zones. Independent of process timezone.
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const ianaTimeZoneSchema = z
  .string()
  .min(1)
  .refine(isIanaTimeZone, {
    message: 'Must be a valid IANA time zone identifier (e.g. Area/Location).',
  });

export type IanaTimeZone = z.infer<typeof ianaTimeZoneSchema>;

/** Civil calendar date `YYYY-MM-DD` (no timezone). */
export const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (expected YYYY-MM-DD).')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m! - 1 &&
      dt.getUTCDate() === d
    );
  }, 'Invalid calendar date.');

export type CivilDate = z.infer<typeof civilDateSchema>;

const WEEKDAY_FROM_UTC_DAY = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

/** Gregorian weekday of a civil date (timezone-independent for the date itself). */
export function weekdayFromCivilDate(
  date: CivilDate,
): (typeof WEEKDAY_FROM_UTC_DAY)[number] {
  const [y, m, d] = date.split('-').map(Number);
  // Noon UTC avoids DST edge cases when constructing the Date.
  const utc = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  return WEEKDAY_FROM_UTC_DAY[utc.getUTCDay()]!;
}

export function eachCivilDateInclusive(
  from: CivilDate,
  to: CivilDate,
): CivilDate[] {
  const dates: CivilDate[] = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let cursor = Date.UTC(fy!, fm! - 1, fd!);
  const end = Date.UTC(ty!, tm! - 1, td!);
  while (cursor <= end) {
    const dt = new Date(cursor);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cursor += 24 * 60 * 60 * 1000;
  }
  return dates;
}

/** Add (or subtract) whole Gregorian days to a civil date. */
export function addCivilDays(date: CivilDate, days: number): CivilDate {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + days));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function zonedParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const map = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );

  return {
    year: Number(map['year']),
    month: Number(map['month']),
    day: Number(map['day']),
    hour: Number(map['hour']),
    minute: Number(map['minute']),
    second: Number(map['second']),
  };
}

/**
 * Converts a civil local date+time in `timeZone` to an absolute instant.
 * Does not read process.env.TZ.
 */
export function zonedLocalDateTimeToUtc(
  date: CivilDate,
  timeOfDay: string,
  timeZone: string,
): Date {
  if (!isIanaTimeZone(timeZone)) {
    throw new Error(`Invalid IANA time zone: ${timeZone}`);
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = timeOfDay.split(':').map(Number);
  const targetAsUtcMs = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0);

  // Iterate: guess UTC instant, read wall time in zone, adjust by delta.
  let guess = targetAsUtcMs;
  for (let i = 0; i < 5; i += 1) {
    const wall = zonedParts(new Date(guess), timeZone);
    const wallAsUtcMs = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    );
    const delta = targetAsUtcMs - wallAsUtcMs;
    guess += delta;
    if (delta === 0) break;
  }

  const verified = zonedParts(new Date(guess), timeZone);
  if (
    verified.year !== year ||
    verified.month !== month ||
    verified.day !== day ||
    verified.hour !== hour ||
    verified.minute !== minute
  ) {
    throw new Error(
      `Could not resolve local ${date} ${timeOfDay} in ${timeZone}.`,
    );
  }

  return new Date(guess);
}
