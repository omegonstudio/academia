import type {
  NotificationRecord,
  NotificationStore,
} from './notification-types.js';

export function createInMemoryNotificationStore(): NotificationStore & {
  rows: NotificationRecord[];
} {
  const rows: NotificationRecord[] = [];
  return {
    rows,
    async create(input) {
      const row: NotificationRecord = {
        id: crypto.randomUUID(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload ?? null,
        readAt: null,
        createdAt: new Date(),
      };
      rows.push(row);
      return row;
    },
    async listForUser(userId, options) {
      return rows
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, options?.limit ?? 50);
    },
    async countUnread(userId) {
      return rows.filter((r) => r.userId === userId && !r.readAt).length;
    },
    async markRead(userId, id) {
      const row = rows.find((r) => r.id === id && r.userId === userId);
      if (!row) return null;
      row.readAt = row.readAt ?? new Date();
      return row;
    },
    async markAllRead(userId) {
      let n = 0;
      for (const row of rows) {
        if (row.userId === userId && !row.readAt) {
          row.readAt = new Date();
          n += 1;
        }
      }
      return n;
    },
  };
}
