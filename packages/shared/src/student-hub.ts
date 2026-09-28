import { z } from 'zod';
import { attendanceStatusSchema } from './attendance.js';
import { courseServiceTypeSchema } from './service-types.js';
import { civilDateSchema } from './timezones.js';

/**
 * Student Hub — self-scoped DTOs.
 * Identity is always resolved from the session; never trust client studentId.
 */

/** Same civil from/to window shape as GET /classes/calendar. */
export const studentAttendanceListQuerySchema = z
  .object({
    from: civilDateSchema,
    to: civilDateSchema,
  })
  .refine((value) => value.from <= value.to, {
    message: 'to must be on or after from.',
    path: ['to'],
  });

export type StudentAttendanceListQuery = z.infer<
  typeof studentAttendanceListQuerySchema
>;

export const studentAttendanceItemSchema = z.object({
  id: z.string().uuid(),
  classSessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

export type StudentAttendanceItem = z.infer<typeof studentAttendanceItemSchema>;

export const studentAttendanceListResponseSchema = z.object({
  from: civilDateSchema,
  to: civilDateSchema,
  attendances: z.array(studentAttendanceItemSchema),
});

export type StudentAttendanceListResponse = z.infer<
  typeof studentAttendanceListResponseSchema
>;
