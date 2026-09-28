import type { ClassSession } from '@academia/shared';
import {
  CALENDAR_DISPLAY_TIMEZONE,
  formatSessionTimeRange,
} from './calendar';

export type ClassScheduleStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export function classScheduleStatus(
  session: Pick<ClassSession, 'startAt' | 'endAt' | 'isActive'>,
  now: Date = new Date(),
): ClassScheduleStatus {
  if (!session.isActive) return 'CANCELLED';
  const start = new Date(session.startAt).getTime();
  const end = new Date(session.endAt).getTime();
  const t = now.getTime();
  if (t < start) return 'SCHEDULED';
  if (t < end) return 'IN_PROGRESS';
  return 'COMPLETED';
}

export const classScheduleStatusLabels: Record<ClassScheduleStatus, string> = {
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

export const classScheduleStatusTones: Record<
  ClassScheduleStatus,
  'info' | 'success' | 'warning' | 'danger'
> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export function formatClassDateShort(isoInstant: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: CALENDAR_DISPLAY_TIMEZONE,
    day: '2-digit',
    month: 'short',
  })
    .format(new Date(isoInstant))
    .replace('.', '')
    .toUpperCase();
}

export function formatClassTime(isoInstant: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: CALENDAR_DISPLAY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(isoInstant));
}

export function formatClassScheduleLabel(
  startAt: string,
  endAt: string,
): string {
  return formatSessionTimeRange(startAt, endAt);
}
