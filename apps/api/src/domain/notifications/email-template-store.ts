import type { NotificationType } from '@academia/shared';
import type { Database } from '../../lib/prisma.js';

export interface EmailTemplateRecord {
  type: NotificationType;
  subject: string;
  body: string;
  updatedAt: Date;
}

export interface EmailTemplateStore {
  list(): Promise<EmailTemplateRecord[]>;
  findByType(type: NotificationType): Promise<EmailTemplateRecord | null>;
  upsert(input: {
    type: NotificationType;
    subject: string;
    body: string;
    updatedByUserId: string;
  }): Promise<EmailTemplateRecord>;
}

function toRecord(row: {
  type: string;
  subject: string;
  body: string;
  updatedAt: Date;
}): EmailTemplateRecord {
  return {
    type: row.type as NotificationType,
    subject: row.subject,
    body: row.body,
    updatedAt: row.updatedAt,
  };
}

export function createEmailTemplateStore(database: Database): EmailTemplateStore {
  return {
    async list() {
      const rows = await database.notificationEmailTemplate.findMany({
        orderBy: { type: 'asc' },
      });
      return rows.map(toRecord);
    },

    async findByType(type) {
      const row = await database.notificationEmailTemplate.findUnique({
        where: { type },
      });
      return row ? toRecord(row) : null;
    },

    async upsert(input) {
      const row = await database.notificationEmailTemplate.upsert({
        where: { type: input.type },
        create: {
          type: input.type,
          subject: input.subject,
          body: input.body,
          updatedByUserId: input.updatedByUserId,
        },
        update: {
          subject: input.subject,
          body: input.body,
          updatedByUserId: input.updatedByUserId,
        },
      });
      return toRecord(row);
    },
  };
}
