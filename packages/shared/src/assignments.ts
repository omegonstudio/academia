import { z } from 'zod';

/**
 * Current Student → Teacher assignment (no history in this stage).
 */
export const teacherAssignmentSchema = z.object({
  studentId: z.string().uuid(),
  teacherId: z.string().uuid(),
  assignedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TeacherAssignment = z.infer<typeof teacherAssignmentSchema>;

export const teacherAssignmentResponseSchema = z.object({
  assignment: teacherAssignmentSchema,
});

export type TeacherAssignmentResponse = z.infer<
  typeof teacherAssignmentResponseSchema
>;

export const assignTeacherRequestSchema = z.object({
  teacherId: z.string().uuid(),
});

export type AssignTeacherRequest = z.infer<typeof assignTeacherRequestSchema>;
