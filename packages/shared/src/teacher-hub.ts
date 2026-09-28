import { z } from 'zod';
import { attendanceStatusSchema } from './attendance.js';
import { courseServiceTypeSchema } from './service-types.js';
import { civilDateSchema } from './timezones.js';

/**
 * Teacher Hub — self-scoped DTOs.
 * Identity is always resolved from the session; never trust client teacherId.
 */

/** Same civil from/to window as calendar / student attendance. */
export const teacherAttendanceListQuerySchema = z
  .object({
    from: civilDateSchema,
    to: civilDateSchema,
  })
  .refine((value) => value.from <= value.to, {
    message: 'to must be on or after from.',
    path: ['to'],
  });

export type TeacherAttendanceListQuery = z.infer<
  typeof teacherAttendanceListQuerySchema
>;

export const teacherHubStudentGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  course: z.object({
    id: z.string().uuid(),
    name: z.string(),
    serviceType: courseServiceTypeSchema,
  }),
});

export const teacherHubStudentSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  level: z.string(),
  isActive: z.boolean(),
  /** True when linked via TeacherAssignment. */
  viaAssignment: z.boolean(),
  /** Active enrollments in groups taught by this teacher. */
  groups: z.array(teacherHubStudentGroupSchema),
});

export type TeacherHubStudent = z.infer<typeof teacherHubStudentSchema>;

export const teacherHubStudentListResponseSchema = z.object({
  students: z.array(teacherHubStudentSchema),
});

export type TeacherHubStudentListResponse = z.infer<
  typeof teacherHubStudentListResponseSchema
>;

export const teacherAttendanceItemSchema = z.object({
  id: z.string().uuid(),
  classSessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  student: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
  }),
  classSession: z.object({
    id: z.string().uuid(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    group: z.object({
      id: z.string().uuid(),
      name: z.string(),
      course: z.object({
        id: z.string().uuid(),
        name: z.string(),
        serviceType: courseServiceTypeSchema,
      }),
    }),
  }),
});

export type TeacherAttendanceItem = z.infer<typeof teacherAttendanceItemSchema>;

export const teacherAttendanceListResponseSchema = z.object({
  from: civilDateSchema,
  to: civilDateSchema,
  attendances: z.array(teacherAttendanceItemSchema),
});

export type TeacherAttendanceListResponse = z.infer<
  typeof teacherAttendanceListResponseSchema
>;
