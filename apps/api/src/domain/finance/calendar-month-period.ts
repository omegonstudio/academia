/**
 * Calendar-month commercial period for GROUP_120 Charges.
 * Bounds are date-only instants at UTC midnight (matches Charge.period* @db.Date).
 * The month is taken from the academy business timezone wall calendar.
 */
export function calendarMonthPeriodForTimezone(
  instant: Date,
  timeZone: string,
): { periodStart: Date; periodEnd: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(instant);

  const map = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  const year = Number(map['year']);
  const month = Number(map['month']);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error(`Unable to resolve calendar month in timezone ${timeZone}`);
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));
  return { periodStart, periodEnd };
}

/** Compare @db.Date values as civil YYYY-MM-DD. */
export function civilDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
