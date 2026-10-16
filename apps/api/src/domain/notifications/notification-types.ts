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
  /** Fallback subject when no email template is stored for `type`. */
  title: string;
  /** Fallback body when no email template is stored for `type`. */
  body: string;
  payload?: Record<string, unknown>;
  /**
   * When set, the publisher loads the Director-edited template for `type`
   * and renders `{{placeholders}}` (plus built-in `loginUrl`).
   */
  templateVars?: Record<string, string>;
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
