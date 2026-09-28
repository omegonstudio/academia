import type { ClassSessionCalendarEvent, CivilDate } from '@academia/shared'
import {
  CALENDAR_DISPLAY_TIMEZONE,
  civilDateInTimeZone,
} from './calendar'

export {
  pickNextClass,
  partitionClasses,
  studentHubClassRange as teacherHubClassRange,
  serviceTypeLabel,
  attendanceStatusLabel,
} from './student-hub'

/** Count sessions whose start falls on the given civil day in the academy timezone. */
export function countClassesOnCivilDay(
  events: readonly ClassSessionCalendarEvent[],
  civilDate: CivilDate,
  timeZone: string = CALENDAR_DISPLAY_TIMEZONE,
): number {
  return events.filter(
    (event) => civilDateInTimeZone(event.startAt, timeZone) === civilDate,
  ).length
}
