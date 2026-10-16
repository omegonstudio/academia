import { z } from 'zod';
import { notificationTypeSchema } from './notifications.js';

export const emailTemplateSchema = z.object({
  type: notificationTypeSchema,
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  updatedAt: z.string().datetime(),
});

export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export const emailTemplateListResponseSchema = z.object({
  templates: z.array(emailTemplateSchema),
  placeholders: z.array(z.string()),
});

export type EmailTemplateListResponse = z.infer<
  typeof emailTemplateListResponseSchema
>;

export const updateEmailTemplateRequestSchema = z.object({
  type: notificationTypeSchema,
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});

export type UpdateEmailTemplateRequest = z.infer<
  typeof updateEmailTemplateRequestSchema
>;

export const emailTemplateResponseSchema = z.object({
  template: emailTemplateSchema,
});

export type EmailTemplateResponse = z.infer<typeof emailTemplateResponseSchema>;

/** Documented placeholders for Director UI copy. */
export const EMAIL_TEMPLATE_PLACEHOLDERS = [
  '{{displayName}}',
  '{{studentName}}',
  '{{teacherName}}',
  '{{roleLabel}}',
  '{{when}}',
  '{{meetingUrl}}',
  '{{loginUrl}}',
] as const;

export const googleMeetStatusResponseSchema = z.object({
  configured: z.boolean(),
  calendarId: z.string().nullable(),
});

export type GoogleMeetStatusResponse = z.infer<
  typeof googleMeetStatusResponseSchema
>;

/** Zoom S2S readiness — never includes secrets, tokens, or account id. */
export const zoomStatusResponseSchema = z.object({
  configured: z.boolean(),
});

export type ZoomStatusResponse = z.infer<typeof zoomStatusResponseSchema>;
