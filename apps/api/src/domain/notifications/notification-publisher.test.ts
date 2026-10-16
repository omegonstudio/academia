import { describe, expect, it, vi } from 'vitest';
import { createNotificationPublisher } from './notification-publisher.js';
import type {
  EmailSender,
  NotificationRecord,
  NotificationStore,
} from './notification-types.js';

function memoryStore(): NotificationStore & { rows: NotificationRecord[] } {
  const rows: NotificationRecord[] = [];
  return {
    rows,
    async create(input) {
      const row: NotificationRecord = {
        id: `n-${rows.length + 1}`,
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
    async listForUser(userId) {
      return rows.filter((r) => r.userId === userId);
    },
    async countUnread(userId) {
      return rows.filter((r) => r.userId === userId && !r.readAt).length;
    },
    async markRead(userId, id) {
      const row = rows.find((r) => r.id === id && r.userId === userId);
      if (!row) return null;
      row.readAt = new Date();
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

describe('createNotificationPublisher', () => {
  it('persists in-app and attempts email', async () => {
    const store = memoryStore();
    const email: EmailSender = {
      send: vi.fn(async () => ({ sent: true })),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as import('pino').Logger;

    const publisher = createNotificationPublisher({
      store,
      email,
      logger,
      appPublicUrl: 'http://localhost:3000',
    });

    const record = await publisher.notify({
      userId: 'u1',
      email: 'a@test.com',
      type: 'USER_CREATED',
      title: 'Hola',
      body: 'Cuenta creada',
    });

    expect(record.id).toBe('n-1');
    expect(store.rows).toHaveLength(1);
    expect(email.send).toHaveBeenCalledOnce();
  });

  it('renders Director email templates when templateVars are set', async () => {
    const store = memoryStore();
    const email: EmailSender = {
      send: vi.fn(async () => ({ sent: true })),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as import('pino').Logger;
    const emailTemplates = {
      async list() {
        return [];
      },
      async findByType(type: string) {
        if (type !== 'CLASS_MEETING_LINK') return null;
        return {
          type: 'CLASS_MEETING_LINK' as const,
          subject: 'Meet: {{when}}',
          body: 'Hola {{displayName}} — {{meetingUrl}} — {{loginUrl}}',
          updatedAt: new Date(),
        };
      },
      async upsert() {
        throw new Error('unused');
      },
    };

    const publisher = createNotificationPublisher({
      store,
      email,
      logger,
      appPublicUrl: 'http://localhost:3000',
      emailTemplates,
    });

    await publisher.notify({
      userId: 'u1',
      email: 'a@test.com',
      type: 'CLASS_MEETING_LINK',
      title: 'Fallback title',
      body: 'Fallback body',
      templateVars: {
        displayName: 'Ana',
        when: 'hoy',
        meetingUrl: 'https://meet.google.com/x',
      },
    });

    expect(store.rows[0]?.title).toBe('Fallback title');
    expect(email.send).toHaveBeenCalledWith({
      to: 'a@test.com',
      subject: 'Meet: hoy',
      text: 'Hola Ana — https://meet.google.com/x — http://localhost:3000/login\n',
    });
  });

  it('does not throw when email fails', async () => {
    const store = memoryStore();
    const email: EmailSender = {
      send: vi.fn(async () => {
        throw new Error('network');
      }),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as import('pino').Logger;

    const publisher = createNotificationPublisher({
      store,
      email,
      logger,
      appPublicUrl: 'http://localhost:3000',
    });

    await expect(
      publisher.notify({
        userId: 'u1',
        email: 'a@test.com',
        type: 'USER_CREATED',
        title: 'Hola',
        body: 'Cuenta creada',
      }),
    ).resolves.toBeTruthy();
    expect(store.rows).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalled();
  });
});
