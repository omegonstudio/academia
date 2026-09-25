import { z } from 'zod';

/**
 * Educational purpose of a Course — orthogonal to serviceType/duration.
 * Groups inherit context via Group → Course; no parallel TeacherTraining* models.
 */
export const COURSE_TYPES = ['REGULAR', 'TEACHER_TRAINING'] as const;

export const courseTypeSchema = z.enum(COURSE_TYPES);
export type CourseType = z.infer<typeof courseTypeSchema>;

export function isCourseType(value: unknown): value is CourseType {
  return courseTypeSchema.safeParse(value).success;
}
