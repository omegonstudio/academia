import { z } from 'zod';

/** CEFR-style levels for Spanish academy placement. */
export const STUDENT_LEVELS = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
] as const;

export const studentLevelSchema = z.enum(STUDENT_LEVELS);
export type StudentLevel = z.infer<typeof studentLevelSchema>;

const namePartSchema = z.string().trim().min(1).max(80);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

/**
 * Public student record. Never includes password hashes or other User secrets.
 */
export const studentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  firstName: namePartSchema,
  lastName: namePartSchema,
  level: studentLevelSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Student = z.infer<typeof studentSchema>;

export const studentListResponseSchema = z.object({
  students: z.array(studentSchema),
});

export type StudentListResponse = z.infer<typeof studentListResponseSchema>;

export const studentResponseSchema = z.object({
  student: studentSchema,
});

export type StudentResponse = z.infer<typeof studentResponseSchema>;

/**
 * Create a registry student. If the email already belongs to a STUDENT user
 * without a profile, password is optional; otherwise password is required to
 * create the identity.
 */
export const createStudentRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(256).optional(),
  firstName: namePartSchema,
  lastName: namePartSchema,
  level: studentLevelSchema,
  isActive: z.boolean().optional(),
});

export type CreateStudentRequest = z.infer<typeof createStudentRequestSchema>;

export const updateStudentRequestSchema = z
  .object({
    firstName: namePartSchema.optional(),
    lastName: namePartSchema.optional(),
    level: studentLevelSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.level !== undefined ||
      value.isActive !== undefined,
    { message: 'At least one field is required.' },
  );

export type UpdateStudentRequest = z.infer<typeof updateStudentRequestSchema>;
