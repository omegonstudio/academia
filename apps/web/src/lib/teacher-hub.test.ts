import { describe, expect, it } from 'vitest'
import type { ClassSessionCalendarEvent } from '@academia/shared'
import {
  countClassesOnCivilDay,
  partitionClasses,
  pickNextClass,
  serviceTypeLabel,
  teacherHubClassRange,
} from './teacher-hub'

function event(
  overrides: Partial<ClassSessionCalendarEvent> & { id: string; startAt: string },
): ClassSessionCalendarEvent {
  const start = new Date(overrides.startAt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    id: overrides.id,
    startAt: overrides.startAt,
    endAt: overrides.endAt ?? end.toISOString(),
    durationMinutes: 60,
    meetingUrl: overrides.meetingUrl ?? null,
    group: overrides.group ?? {
      id: 'g1',
      name: 'Grupo',
      course: {
        id: 'c1',
        name: 'Español A1',
        serviceType: 'ONE_TO_ONE_60',
        courseType: 'REGULAR',
      },
    },
    teacher: overrides.teacher ?? {
      id: 't1',
      firstName: 'Ana',
      lastName: 'Docente',
    },
  }
}

describe('teacher-hub helpers', () => {
  const now = new Date('2026-09-20T12:00:00.000Z')

  it('picks the next upcoming class and empty when none', () => {
    const events = [
      event({ id: 'past', startAt: '2026-09-19T15:00:00.000Z' }),
      event({ id: 'soon', startAt: '2026-09-21T15:00:00.000Z' }),
      event({ id: 'later', startAt: '2026-09-28T15:00:00.000Z' }),
    ]
    expect(pickNextClass(events, now)?.id).toBe('soon')
    expect(pickNextClass([], now)).toBeNull()
  })

  it('partitions upcoming vs past', () => {
    const { upcoming, past } = partitionClasses(
      [
        event({ id: 'past', startAt: '2026-09-10T15:00:00.000Z' }),
        event({ id: 'soon', startAt: '2026-09-22T15:00:00.000Z' }),
      ],
      now,
    )
    expect(upcoming.map((e) => e.id)).toEqual(['soon'])
    expect(past.map((e) => e.id)).toEqual(['past'])
  })

  it('counts classes on a civil day', () => {
    const events = [
      event({ id: 'a', startAt: '2026-09-20T14:00:00.000Z' }),
      event({ id: 'b', startAt: '2026-09-20T18:00:00.000Z' }),
      event({ id: 'c', startAt: '2026-09-21T14:00:00.000Z' }),
    ]
    expect(countClassesOnCivilDay(events, '2026-09-20', 'UTC')).toBe(2)
    expect(countClassesOnCivilDay(events, '2026-09-21', 'UTC')).toBe(1)
    expect(countClassesOnCivilDay(events, '2026-09-19', 'UTC')).toBe(0)
  })

  it('returns zero for empty events on day count', () => {
    expect(countClassesOnCivilDay([], '2026-09-20', 'UTC')).toBe(0)
  })

  it('exposes the same class range window as student hub', () => {
    const range = teacherHubClassRange(now)
    expect(range.from).toBe('2026-08-30')
    expect(range.to).toBe('2026-11-29')
  })

  it('reuses service type labels from student hub', () => {
    expect(serviceTypeLabel('GROUP_120')).toMatch(/grupo/i)
  })
})
