import { z } from 'zod';

/**
 * Attendance outcome for a Student in a ClassSession.
 * Only PRESENT / ABSENT in MVP — no JUSTIFIED until product needs it.
 */
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT'] as const;

export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return attendanceStatusSchema.safeParse(value).success;
}

/** Minimal student identity for attendance lists (no email / secrets). */
export const attendanceStudentSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
});

export type AttendanceStudent = z.infer<typeof attendanceStudentSchema>;

export const attendanceSchema = z.object({
  id: z.string().uuid(),
  classSessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  student: attendanceStudentSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Attendance = z.infer<typeof attendanceSchema>;

export const attendanceListResponseSchema = z.object({
  attendances: z.array(attendanceSchema),
});

export type AttendanceListResponse = z.infer<
  typeof attendanceListResponseSchema
>;

export const attendanceResponseSchema = z.object({
  attendance: attendanceSchema,
});

export type AttendanceResponse = z.infer<typeof attendanceResponseSchema>;

export const createAttendanceRequestSchema = z.object({
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
});

export type CreateAttendanceRequest = z.infer<
  typeof createAttendanceRequestSchema
>;

export const updateAttendanceRequestSchema = z.object({
  status: attendanceStatusSchema,
});

export type UpdateAttendanceRequest = z.infer<
  typeof updateAttendanceRequestSchema
>;
