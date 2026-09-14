import { z } from 'zod';
import { courseTypeSchema } from './course-types.js';
import { courseServiceTypeSchema } from './service-types.js';
import { civilDateSchema } from './timezones.js';

/**
 * Absolute https URL for an external meeting room.
 * Rejects javascript:/data:/file:/http: and non-absolute values.
 */
export const meetingUrlSchema = z
  .url({
    protocol: /^https$/,
    hostname: z.regexes.domain,
    error: 'Must be an absolute https URL.',
  })
  .max(2048);

export type MeetingUrl = z.infer<typeof meetingUrlSchema>;

/**
 * Concrete class occurrence for a Group.
 * Duration is derived from Group → Course.serviceType (not persisted).
 */
export const classSessionSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  serviceType: courseServiceTypeSchema,
  durationMinutes: z.union([z.literal(60), z.literal(90), z.literal(120)]),
  scheduleOptionId: z.string().uuid().nullable(),
  teacherId: z.string().uuid().nullable(),
  meetingUrl: meetingUrlSchema.nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ClassSession = z.infer<typeof classSessionSchema>;

export const classSessionListResponseSchema = z.object({
  classSessions: z.array(classSessionSchema),
});

export type ClassSessionListResponse = z.infer<
  typeof classSessionListResponseSchema
>;

export const classSessionResponseSchema = z.object({
  classSession: classSessionSchema,
});

export type ClassSessionResponse = z.infer<typeof classSessionResponseSchema>;

export const createClassSessionRequestSchema = z.object({
  groupId: z.string().uuid(),
  /** Instant when the class starts. endAt is derived from Course.serviceType. */
  startAt: z.string().datetime(),
  meetingUrl: meetingUrlSchema.optional(),
});

export type CreateClassSessionRequest = z.infer<
  typeof createClassSessionRequestSchema
>;

export const updateClassSessionRequestSchema = z
  .object({
    startAt: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
    /** Set to null to clear an existing meeting URL. */
    meetingUrl: meetingUrlSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.startAt !== undefined ||
      value.isActive !== undefined ||
      value.meetingUrl !== undefined,
    { message: 'At least one field is required.' },
  );

export type UpdateClassSessionRequest = z.infer<
  typeof updateClassSessionRequestSchema
>;

/** Inclusive civil-date range for weekly generation from ScheduleOption. */
export const CLASS_SESSION_GENERATE_MAX_DAYS = 90;

/** Max inclusive civil-day span for GET /classes/calendar (~3 months). */
export const CLASS_SESSION_CALENDAR_MAX_DAYS = 93;

export const generateClassSessionsRequestSchema = z
  .object({
    from: civilDateSchema,
    to: civilDateSchema,
  })
  .refine((value) => value.from <= value.to, {
    message: 'to must be on or after from.',
    path: ['to'],
  });

export type GenerateClassSessionsRequest = z.infer<
  typeof generateClassSessionsRequestSchema
>;

export const generateClassSessionsResponseSchema = z.object({
  groupId: z.string().uuid(),
  from: civilDateSchema,
  to: civilDateSchema,
  /** Newly inserted sessions. */
  generatedCount: z.number().int().nonnegative(),
  /** Skipped because UNIQUE(groupId, startAt) already existed. */
  skippedCount: z.number().int().nonnegative(),
  /** Skipped because they would overlap another active session of the same teacher. */
  conflictCount: z.number().int().nonnegative(),
  classSessions: z.array(classSessionSchema),
});

export type GenerateClassSessionsResponse = z.infer<
  typeof generateClassSessionsResponseSchema
>;

/**
 * Calendar query: civil dates in academy business timezone.
 * Same from/to validation as generate; max days = CLASS_SESSION_CALENDAR_MAX_DAYS.
 */
export const classSessionCalendarQuerySchema = z
  .object({
    from: civilDateSchema,
    to: civilDateSchema,
  })
  .refine((value) => value.from <= value.to, {
    message: 'to must be on or after from.',
    path: ['to'],
  });

export type ClassSessionCalendarQuery = z.infer<
  typeof classSessionCalendarQuerySchema
>;

/** Read model for calendar UI — relations via Group, not denormalized FKs. */
export const classSessionCalendarEventSchema = z.object({
  id: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  durationMinutes: z.union([z.literal(60), z.literal(90), z.literal(120)]),
  meetingUrl: meetingUrlSchema.nullable(),
  group: z.object({
    id: z.string().uuid(),
    name: z.string(),
    course: z.object({
      id: z.string().uuid(),
      name: z.string(),
      serviceType: courseServiceTypeSchema,
      courseType: courseTypeSchema,
    }),
  }),
  teacher: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
    })
    .nullable(),
});

export type ClassSessionCalendarEvent = z.infer<
  typeof classSessionCalendarEventSchema
>;

export const classSessionCalendarResponseSchema = z.object({
  from: civilDateSchema,
  to: civilDateSchema,
  classSessions: z.array(classSessionCalendarEventSchema),
});

export type ClassSessionCalendarResponse = z.infer<
  typeof classSessionCalendarResponseSchema
>;
