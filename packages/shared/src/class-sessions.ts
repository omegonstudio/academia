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

/** Plain-text Meet/Calendar description (may include URLs). */
export const meetingDescriptionSchema = z.string().trim().max(4000);
export type MeetingDescription = z.infer<typeof meetingDescriptionSchema>;

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
  /** Google Calendar event id when Meet was provisioned by the API. */
  googleCalendarEventId: z.string().max(1024).nullable(),
  /** Zoom meeting id when Zoom was provisioned by the API. */
  zoomMeetingId: z.string().max(255).nullable(),
  /** Text sent to the Google Calendar / Meet event description. */
  meetingDescription: meetingDescriptionSchema.nullable(),
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
  /**
   * Present on POST /classes when the class was persisted but Google Meet
   * provisioning failed. Client should open the class and retry via PATCH
   * `createGoogleMeet` (do not create a second class).
   */
  meetCreationFailed: z.boolean().optional(),
  /**
   * Present on POST /classes when the class was persisted but Zoom
   * provisioning failed. Client should open the class and retry via PATCH
   * `createZoom` (do not create a second class).
   */
  zoomCreationFailed: z.boolean().optional(),
});

export type ClassSessionResponse = z.infer<typeof classSessionResponseSchema>;

export const createClassSessionRequestSchema = z
  .object({
    groupId: z.string().uuid(),
    /** Instant when the class starts. endAt is derived from Course.serviceType. */
    startAt: z.string().datetime(),
    meetingUrl: meetingUrlSchema.optional(),
    meetingDescription: meetingDescriptionSchema.optional(),
    /**
     * When true, the API creates a Google Calendar event with Meet for this
     * start/end and sets meetingUrl. Requires Google Meet credentials.
     */
    createGoogleMeet: z.boolean().optional(),
    /**
     * When true, the API creates a Zoom meeting for this start/end and sets
     * meetingUrl + zoomMeetingId. Requires Zoom credentials.
     */
    createZoom: z.boolean().optional(),
  })
  .refine((value) => !(value.createGoogleMeet && value.meetingUrl), {
    message: 'Use createGoogleMeet or meetingUrl, not both.',
    path: ['createGoogleMeet'],
  })
  .refine((value) => !(value.createZoom && value.meetingUrl), {
    message: 'Use createZoom or meetingUrl, not both.',
    path: ['createZoom'],
  })
  .refine((value) => !(value.createZoom && value.createGoogleMeet), {
    message: 'Use createZoom or createGoogleMeet, not both.',
    path: ['createZoom'],
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
    meetingDescription: meetingDescriptionSchema.nullable().optional(),
    /** Server-set after Meet create; clients normally omit. Null clears. */
    googleCalendarEventId: z.string().max(1024).nullable().optional(),
    /** Server-set after Zoom create; clients normally omit. Null clears. */
    zoomMeetingId: z.string().max(255).nullable().optional(),
    createGoogleMeet: z.boolean().optional(),
    /**
     * When true, deletes the Google Calendar event (best-effort) and clears
     * meetingUrl + googleCalendarEventId. Keeps meetingDescription.
     */
    removeGoogleMeet: z.boolean().optional(),
    createZoom: z.boolean().optional(),
    /**
     * When true and zoomMeetingId is set, deletes the Zoom meeting (best-effort)
     * and clears meetingUrl + zoomMeetingId. Does not clear a manual URL when
     * there is no managed Zoom id. Keeps meetingDescription.
     */
    removeZoom: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.startAt !== undefined ||
      value.isActive !== undefined ||
      value.meetingUrl !== undefined ||
      value.meetingDescription !== undefined ||
      value.googleCalendarEventId !== undefined ||
      value.zoomMeetingId !== undefined ||
      value.createGoogleMeet === true ||
      value.removeGoogleMeet === true ||
      value.createZoom === true ||
      value.removeZoom === true,
    { message: 'At least one field is required.' },
  )
  .refine((value) => !(value.createGoogleMeet && value.meetingUrl), {
    message: 'Use createGoogleMeet or meetingUrl, not both.',
    path: ['createGoogleMeet'],
  })
  .refine((value) => !(value.createZoom && value.meetingUrl), {
    message: 'Use createZoom or meetingUrl, not both.',
    path: ['createZoom'],
  })
  .refine((value) => !(value.createZoom && value.createGoogleMeet), {
    message: 'Use createZoom or createGoogleMeet, not both.',
    path: ['createZoom'],
  })
  .refine((value) => !(value.createGoogleMeet && value.removeGoogleMeet), {
    message: 'Use createGoogleMeet or removeGoogleMeet, not both.',
    path: ['removeGoogleMeet'],
  })
  .refine((value) => !(value.createZoom && value.removeZoom), {
    message: 'Use createZoom or removeZoom, not both.',
    path: ['removeZoom'],
  })
  .refine((value) => !(value.createZoom && value.removeGoogleMeet), {
    message: 'Use createZoom or removeGoogleMeet, not both.',
    path: ['createZoom'],
  })
  .refine((value) => !(value.createGoogleMeet && value.removeZoom), {
    message: 'Use createGoogleMeet or removeZoom, not both.',
    path: ['createGoogleMeet'],
  });

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
