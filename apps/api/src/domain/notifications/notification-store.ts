import type { NotificationType } from '@academia/shared';
import { notificationTypeSchema } from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import type {
  NotificationRecord,
  NotificationStore,
} from './notification-types.js';

function mapRow(row: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRecord {
  const parsedType = notificationTypeSchema.safeParse(row.type);
  return {
    id: row.id,
    userId: row.userId,
    type: parsedType.success ? parsedType.data : 'USER_CREATED',
    title: row.title,
    body: row.body,
    payload:
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export function createNotificationStore(database: Database): NotificationStore {
  return {
    async create(input) {
      const row = await database.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          ...(input.payload
            ? { payload: input.payload as object }
            : {}),
        },
      });
      return mapRow(row);
    },

    async listForUser(userId, options) {
      const rows = await database.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
      });
      return rows.map(mapRow);
    },

    async countUnread(userId) {
      return database.notification.count({
        where: { userId, readAt: null },
      });
    },

    async markRead(userId, id) {
      const existing = await database.notification.findFirst({
        where: { id, userId },
      });
      if (!existing) return null;
      if (existing.readAt) return mapRow(existing);
      const row = await database.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
      return mapRow(row);
    },

    async markAllRead(userId) {
      const result = await database.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      return result.count;
    },
  };
}

export function isNotificationType(value: string): value is NotificationType {
  return notificationTypeSchema.safeParse(value).success;
}
