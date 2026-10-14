import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'USER_CREATED',
  'TEACHER_ASSIGNED',
  'CLASS_MEETING_LINK',
] as const;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  payload: z.record(z.string(), z.unknown()).nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
});

export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;

export const notificationResponseSchema = z.object({
  notification: notificationSchema,
});

export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

export const markNotificationsReadResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
});

export type MarkNotificationsReadResponse = z.infer<
  typeof markNotificationsReadResponseSchema
>;
