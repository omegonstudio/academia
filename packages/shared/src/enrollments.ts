import { z } from 'zod';

/** Product rule: one Group may have at most this many active students. */
export const GROUP_MAX_ACTIVE_ENROLLMENTS = 15;

/**
 * Membership of a Student in a Group.
 * Soft-deactivate via isActive; one row per (groupId, studentId).
 */
export const enrollmentSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  studentId: z.string().uuid(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Enrollment = z.infer<typeof enrollmentSchema>;

export const enrollmentListResponseSchema = z.object({
  enrollments: z.array(enrollmentSchema),
});

export type EnrollmentListResponse = z.infer<
  typeof enrollmentListResponseSchema
>;

export const enrollmentResponseSchema = z.object({
  enrollment: enrollmentSchema,
});

export type EnrollmentResponse = z.infer<typeof enrollmentResponseSchema>;

export const enrollStudentRequestSchema = z.object({
  studentId: z.string().uuid(),
});

export type EnrollStudentRequest = z.infer<typeof enrollStudentRequestSchema>;
