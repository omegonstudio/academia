import { describe, expect, it } from 'vitest';
import {
  civilMonthRange,
  resolveCivilMonthFromSearchParams,
  shiftCivilMonth,
  todayCivilDate,
} from './calendar.js';

describe('calendar civil helpers', () => {
  it('builds inclusive month ranges including February leap days', () => {
    expect(civilMonthRange({ year: 2026, month: 9 })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(civilMonthRange({ year: 2024, month: 2 })).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
  });

  it('shifts months across year boundaries', () => {
    expect(shiftCivilMonth({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
    expect(shiftCivilMonth({ year: 2025, month: 12 }, 1)).toEqual({
      year: 2026,
      month: 1,
    });
  });

  it('resolves search params or falls back to academy today', () => {
    expect(
      resolveCivilMonthFromSearchParams(
        { year: '2026', month: '9' },
        'America/Argentina/Buenos_Aires',
      ),
    ).toEqual({ year: 2026, month: 9 });

    const fixed = new Date('2026-09-14T15:00:00.000Z');
    expect(
      resolveCivilMonthFromSearchParams(
        { year: 'nope', month: '13' },
        'America/Argentina/Buenos_Aires',
        fixed,
      ),
    ).toEqual(
      (() => {
        const today = todayCivilDate('America/Argentina/Buenos_Aires', fixed);
        const [year, month] = today.split('-').map(Number);
        return { year: year!, month: month! };
      })(),
    );
  });
});
