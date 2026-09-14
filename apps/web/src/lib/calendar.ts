import {
  DEFAULT_ACADEMY_TIMEZONE,
  type CivilDate,
  type ClassSessionCalendarEvent,
} from '@academia/shared';

/** Academy business zone for calendar civil ranges and display (matches API default). */
export const CALENDAR_DISPLAY_TIMEZONE = DEFAULT_ACADEMY_TIMEZONE;

export interface CivilMonth {
  year: number;
  /** 1–12 */
  month: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function civilDateFromParts(year: number, month: number, day: number): CivilDate {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Today's civil date in the academy business timezone. */
export function todayCivilDate(
  timeZone: string = CALENDAR_DISPLAY_TIMEZONE,
  now: Date = new Date(),
): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return `${map['year']}-${map['month']}-${map['day']}` as CivilDate;
}

export function civilMonthFromDate(date: CivilDate): CivilMonth {
  const [year, month] = date.split('-').map(Number);
  return { year: year!, month: month! };
}

export function shiftCivilMonth(month: CivilMonth, delta: number): CivilMonth {
  const index = month.year * 12 + (month.month - 1) + delta;
  const year = Math.floor(index / 12);
  const monthNumber = (index % 12) + 1;
  return { year, month: monthNumber };
}

/** Inclusive civil from/to for a Gregorian month (always ≤ 31 days). */
export function civilMonthRange(month: CivilMonth): { from: CivilDate; to: CivilDate } {
  const lastDay = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  return {
    from: civilDateFromParts(month.year, month.month, 1),
    to: civilDateFromParts(month.year, month.month, lastDay),
  };
}

/**
 * Parses `?year=&month=` for calendar navigation.
 * Invalid or missing values fall back to the academy "today" month.
 */
export function resolveCivilMonthFromSearchParams(
  params: { year?: string; month?: string },
  timeZone: string = CALENDAR_DISPLAY_TIMEZONE,
  now: Date = new Date(),
): CivilMonth {
  const year = params.year ? Number(params.year) : Number.NaN;
  const month = params.month ? Number(params.month) : Number.NaN;
  if (
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  ) {
    return { year, month };
  }
  return civilMonthFromDate(todayCivilDate(timeZone, now));
}

export function formatMonthHeading(
  month: CivilMonth,
  locale = 'es-AR',
): string {
  // Noon UTC on the 1st avoids DST edge noise for month labels.
  const instant = new Date(Date.UTC(month.year, month.month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(instant);
}

export function civilDateInTimeZone(
  isoInstant: string,
  timeZone: string = CALENDAR_DISPLAY_TIMEZONE,
): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(isoInstant));
  const map = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return `${map['year']}-${map['month']}-${map['day']}` as CivilDate;
}

export function formatSessionTimeRange(
  startAt: string,
  endAt: string,
  timeZone: string = CALENDAR_DISPLAY_TIMEZONE,
  locale = 'es-AR',
): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const day = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(start);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${day} · ${time.format(start)}–${time.format(end)}`;
}

export function formatDayHeading(
  civilDate: CivilDate,
  locale = 'es-AR',
): string {
  const [y, m, d] = civilDate.split('-').map(Number);
  const instant = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(instant);
}

export function groupSessionsByCivilDay(
  sessions: readonly ClassSessionCalendarEvent[],
  timeZone: string = CALENDAR_DISPLAY_TIMEZONE,
): Array<{ day: CivilDate; sessions: ClassSessionCalendarEvent[] }> {
  const buckets = new Map<CivilDate, ClassSessionCalendarEvent[]>();
  for (const session of sessions) {
    const day = civilDateInTimeZone(session.startAt, timeZone);
    const list = buckets.get(day);
    if (list) {
      list.push(session);
    } else {
      buckets.set(day, [session]);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, daySessions]) => ({ day, sessions: daySessions }));
}

export function serviceTypeLabel(
  serviceType: ClassSessionCalendarEvent['group']['course']['serviceType'],
): string {
  switch (serviceType) {
    case 'ONE_TO_ONE_60':
      return '1:1 · 60 min';
    case 'ONE_TO_ONE_90':
      return '1:1 · 90 min';
    case 'GROUP_120':
      return 'Grupo · 120 min';
    default:
      return serviceType;
  }
}
