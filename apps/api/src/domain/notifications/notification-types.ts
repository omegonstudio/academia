import type { NotificationType } from '@academia/shared';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotifyInput {
  userId: string;
  email: string;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

export interface NotificationStore {
  create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<NotificationRecord>;
  listForUser(
    userId: string,
    options?: { limit?: number },
  ): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<NotificationRecord | null>;
  markAllRead(userId: string): Promise<number>;
}

export interface EmailSender {
  send(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<{ sent: boolean; skipped?: string }>;
}

export interface NotificationPublisher {
  notify(input: NotifyInput): Promise<NotificationRecord>;
  notifyMany(inputs: readonly NotifyInput[]): Promise<void>;
}
