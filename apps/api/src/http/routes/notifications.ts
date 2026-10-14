import {
  markNotificationsReadResponseSchema,
  notificationListResponseSchema,
  notificationResponseSchema,
  type MarkNotificationsReadResponse,
  type NotificationListResponse,
  type NotificationResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { NotificationStore } from '../../domain/notifications/notification-types.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface NotificationsDependencies {
  authenticate: AuthenticateOptions;
  notifications: NotificationStore;
}

function toDto(record: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: record.id,
    userId: record.userId,
    type: record.type,
    title: record.title,
    body: record.body,
    payload: record.payload,
    readAt: record.readAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function createNotificationsRouter({
  authenticate: authOptions,
  notifications,
}: NotificationsDependencies): Router {
  const router = Router();

  router.get('/notifications', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const userId = req.user!.id;
        const [rows, unreadCount] = await Promise.all([
          notifications.listForUser(userId),
          notifications.countUnread(userId),
        ]);
        const body: NotificationListResponse = {
          notifications: rows.map(toDto) as NotificationListResponse['notifications'],
          unreadCount,
        };
        notificationListResponseSchema.parse(body);
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    })();
  });

  router.patch(
    '/notifications/:id/read',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const rawId = req.params['id'];
          const id = typeof rawId === 'string' ? rawId : rawId?.[0];
          if (!id) throw new BadRequestError('Notification id is required.');
          const row = await notifications.markRead(req.user!.id, id);
          if (!row) throw new NotFoundError('Notification not found.');
          const body: NotificationResponse = {
            notification: toDto(row) as NotificationResponse['notification'],
          };
          notificationResponseSchema.parse(body);
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/notifications/read-all',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const updated = await notifications.markAllRead(req.user!.id);
          const body: MarkNotificationsReadResponse = { updated };
          markNotificationsReadResponseSchema.parse(body);
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}
