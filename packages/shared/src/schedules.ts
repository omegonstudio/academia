import { z } from 'zod';

export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;

/** 24h clock `HH:mm` (no timezone). */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (expected HH:mm).');

export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

const WEEKDAY_LABELS_ES: Record<Weekday, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export function formatScheduleLabel(
  day: Weekday,
  startTime: TimeOfDay,
  endTime: TimeOfDay,
): string {
  return `${WEEKDAY_LABELS_ES[day]} ${startTime}–${endTime}`;
}

export function parseTimeToMinutes(value: TimeOfDay): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours! * 60 + minutes!;
}

export const scheduleOptionSchema = z.object({
  id: z.string().uuid(),
  day: weekdaySchema,
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  label: z.string().min(1).max(80),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ScheduleOption = z.infer<typeof scheduleOptionSchema>;

export const scheduleOptionListResponseSchema = z.object({
  scheduleOptions: z.array(scheduleOptionSchema),
});

export type ScheduleOptionListResponse = z.infer<
  typeof scheduleOptionListResponseSchema
>;

export const scheduleOptionResponseSchema = z.object({
  scheduleOption: scheduleOptionSchema,
});

export type ScheduleOptionResponse = z.infer<
  typeof scheduleOptionResponseSchema
>;

export const createScheduleOptionRequestSchema = z
  .object({
    day: weekdaySchema,
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      parseTimeToMinutes(value.startTime) < parseTimeToMinutes(value.endTime),
    { message: 'startTime must be before endTime.', path: ['endTime'] },
  );

export type CreateScheduleOptionRequest = z.infer<
  typeof createScheduleOptionRequestSchema
>;

export const updateScheduleOptionRequestSchema = z
  .object({
    day: weekdaySchema.optional(),
    startTime: timeOfDaySchema.optional(),
    endTime: timeOfDaySchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.day !== undefined ||
      value.startTime !== undefined ||
      value.endTime !== undefined ||
      value.isActive !== undefined,
    { message: 'At least one field is required.' },
  );

export type UpdateScheduleOptionRequest = z.infer<
  typeof updateScheduleOptionRequestSchema
>;

export const assignGroupTeacherRequestSchema = z.object({
  teacherId: z.string().uuid(),
});

export type AssignGroupTeacherRequest = z.infer<
  typeof assignGroupTeacherRequestSchema
>;

export const groupTeacherResponseSchema = z.object({
  groupId: z.string().uuid(),
  teacherId: z.string().uuid(),
});

export type GroupTeacherResponse = z.infer<typeof groupTeacherResponseSchema>;
