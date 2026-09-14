import { z } from 'zod';

/**
 * Academic service configuration for a Course.
 * Duration is derived — do not store free-form minutes as source of truth.
 * ClassSession (Stage 4) will resolve Course via Group and use this map.
 */
export const COURSE_SERVICE_TYPES = [
  'ONE_TO_ONE_60',
  'ONE_TO_ONE_90',
  'GROUP_120',
] as const;

export const courseServiceTypeSchema = z.enum(COURSE_SERVICE_TYPES);
export type CourseServiceType = z.infer<typeof courseServiceTypeSchema>;

export const COURSE_SERVICE_DURATION_MINUTES = {
  ONE_TO_ONE_60: 60,
  ONE_TO_ONE_90: 90,
  GROUP_120: 120,
} as const satisfies Record<CourseServiceType, 60 | 90 | 120>;

export type CourseServiceDurationMinutes =
  (typeof COURSE_SERVICE_DURATION_MINUTES)[CourseServiceType];

export function durationMinutesForServiceType(
  serviceType: CourseServiceType,
): CourseServiceDurationMinutes {
  return COURSE_SERVICE_DURATION_MINUTES[serviceType];
}

export function isCourseServiceType(
  value: unknown,
): value is CourseServiceType {
  return courseServiceTypeSchema.safeParse(value).success;
}
