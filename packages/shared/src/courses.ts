import { z } from 'zod';
import { courseTypeSchema } from './course-types.js';
import {
  courseServiceTypeSchema,
  durationMinutesForServiceType,
  type CourseServiceType,
} from './service-types.js';

const nameSchema = z.string().trim().min(1).max(120);
const descriptionSchema = z.string().trim().max(500);

export const courseSchema = z.object({
  id: z.string().uuid(),
  name: nameSchema,
  description: z.string().nullable(),
  courseType: courseTypeSchema,
  serviceType: courseServiceTypeSchema,
  /** Derived from serviceType — single source of truth for ClassSession. */
  durationMinutes: z.union([z.literal(60), z.literal(90), z.literal(120)]),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Course = z.infer<typeof courseSchema>;

export const courseListResponseSchema = z.object({
  courses: z.array(courseSchema),
});

export type CourseListResponse = z.infer<typeof courseListResponseSchema>;

export const courseResponseSchema = z.object({
  course: courseSchema,
});

export type CourseResponse = z.infer<typeof courseResponseSchema>;

export const createCourseRequestSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional(),
  courseType: courseTypeSchema,
  serviceType: courseServiceTypeSchema,
  isActive: z.boolean().optional(),
});

export type CreateCourseRequest = z.infer<typeof createCourseRequestSchema>;

export const updateCourseRequestSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    courseType: courseTypeSchema.optional(),
    serviceType: courseServiceTypeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.courseType !== undefined ||
      value.serviceType !== undefined ||
      value.isActive !== undefined,
    { message: 'At least one field is required.' },
  );

export type UpdateCourseRequest = z.infer<typeof updateCourseRequestSchema>;

export function courseDurationMinutes(
  serviceType: CourseServiceType,
): 60 | 90 | 120 {
  return durationMinutesForServiceType(serviceType);
}
