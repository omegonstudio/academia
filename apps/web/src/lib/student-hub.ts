import { addCivilDays, type ClassSessionCalendarEvent, type CivilDate } from '@academia/shared'
import { todayCivilDate } from './calendar'

/** Upcoming session: startAt >= now, earliest first. */
export function pickNextClass(
  events: readonly ClassSessionCalendarEvent[],
  now: Date = new Date(),
): ClassSessionCalendarEvent | null {
  const t = now.getTime()
  const upcoming = events
    .filter((event) => new Date(event.startAt).getTime() >= t)
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
  return upcoming[0] ?? null
}

export function partitionClasses(
  events: readonly ClassSessionCalendarEvent[],
  now: Date = new Date(),
): {
  upcoming: ClassSessionCalendarEvent[]
  past: ClassSessionCalendarEvent[]
} {
  const t = now.getTime()
  const upcoming: ClassSessionCalendarEvent[] = []
  const past: ClassSessionCalendarEvent[] = []
  for (const event of events) {
    if (new Date(event.startAt).getTime() >= t) {
      upcoming.push(event)
    } else {
      past.push(event)
    }
  }
  upcoming.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )
  past.sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  )
  return { upcoming, past }
}

/** Civil window for student hub lists (≤ 93 days inclusive). */
export function studentHubClassRange(
  now: Date = new Date(),
): { from: CivilDate; to: CivilDate } {
  const today = todayCivilDate(undefined, now)
  return {
    from: addCivilDays(today, -21),
    to: addCivilDays(today, 70),
  }
}

export function teacherDisplayName(
  teacher: ClassSessionCalendarEvent['teacher'],
): string {
  if (!teacher) return 'Sin profesor asignado'
  return `${teacher.firstName} ${teacher.lastName}`.trim()
}

export function serviceTypeLabel(serviceType: string): string {
  switch (serviceType) {
    case 'ONE_TO_ONE_60':
      return '1:1 · 60 min'
    case 'ONE_TO_ONE_90':
      return '1:1 · 90 min'
    case 'GROUP_120':
      return 'Grupo · 120 min'
    default:
      return serviceType
  }
}

export function attendanceStatusLabel(status: string): string {
  switch (status) {
    case 'PRESENT':
      return 'Presente'
    case 'ABSENT':
      return 'Ausente'
    default:
      return status
  }
}
