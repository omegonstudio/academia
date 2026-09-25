import { z } from 'zod';
import { STUDENT_LEVELS, studentLevelSchema } from './students.js';

/** Teaching level uses the same CEFR scale as student placement. */
export const TEACHER_LEVELS = STUDENT_LEVELS;
export const teacherLevelSchema = studentLevelSchema;
export type TeacherLevel = z.infer<typeof teacherLevelSchema>;

/** Basic availability for assignment; distinct from account isActive. */
export const TEACHER_AVAILABILITIES = [
  'AVAILABLE',
  'UNAVAILABLE',
  'LIMITED',
] as const;

export const teacherAvailabilitySchema = z.enum(TEACHER_AVAILABILITIES);
export type TeacherAvailability = z.infer<typeof teacherAvailabilitySchema>;

const namePartSchema = z.string().trim().min(1).max(80);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

/**
 * Public teacher record. Never includes password hashes or other User secrets.
 */
export const teacherSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  firstName: namePartSchema,
  lastName: namePartSchema,
  level: teacherLevelSchema,
  availability: teacherAvailabilitySchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Teacher = z.infer<typeof teacherSchema>;

export const teacherListResponseSchema = z.object({
  teachers: z.array(teacherSchema),
});

export type TeacherListResponse = z.infer<typeof teacherListResponseSchema>;

export const teacherResponseSchema = z.object({
  teacher: teacherSchema,
});

export type TeacherResponse = z.infer<typeof teacherResponseSchema>;

/**
 * Create a registry teacher. If the email already belongs to a TEACHER user
 * without a profile, password is optional; otherwise password is required.
 */
export const createTeacherRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(256).optional(),
  firstName: namePartSchema,
  lastName: namePartSchema,
  level: teacherLevelSchema,
  availability: teacherAvailabilitySchema.optional(),
  isActive: z.boolean().optional(),
});

export type CreateTeacherRequest = z.infer<typeof createTeacherRequestSchema>;

export const updateTeacherRequestSchema = z
  .object({
    firstName: namePartSchema.optional(),
    lastName: namePartSchema.optional(),
    level: teacherLevelSchema.optional(),
    availability: teacherAvailabilitySchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.level !== undefined ||
      value.availability !== undefined ||
      value.isActive !== undefined,
    { message: 'At least one field is required.' },
  );

export type UpdateTeacherRequest = z.infer<typeof updateTeacherRequestSchema>;
