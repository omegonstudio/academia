import type { Database } from '../../lib/prisma.js';
import type {
  ClassNoteRecord,
  ClassNoteStore,
} from './class-note-service.js';

type DbClient = Pick<Database, 'classNote' | 'classSession'>;

function mapRow(row: {
  id: string;
  classSessionId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}): ClassNoteRecord {
  return {
    id: row.id,
    classSessionId: row.classSessionId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createClassNoteStore(database: DbClient): ClassNoteStore {
  return {
    async findClassSession(classSessionId) {
      const row = await database.classSession.findUnique({
        where: { id: classSessionId },
        select: {
          id: true,
          groupId: true,
          isActive: true,
          group: { select: { teacherId: true } },
        },
      });
      if (!row) return null;
      return {
        id: row.id,
        groupId: row.groupId,
        isActive: row.isActive,
        teacherId: row.group.teacherId,
      };
    },

    async listByClassSession(classSessionId) {
      const rows = await database.classNote.findMany({
        where: { classSessionId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async findById(noteId) {
      const row = await database.classNote.findUnique({
        where: { id: noteId },
      });
      return row ? mapRow(row) : null;
    },

    async create(input) {
      const row = await database.classNote.create({
        data: {
          classSessionId: input.classSessionId,
          content: input.content,
        },
      });
      return mapRow(row);
    },

    async updateContent(noteId, content) {
      const existing = await database.classNote.findUnique({
        where: { id: noteId },
        select: { id: true },
      });
      if (!existing) return null;

      const row = await database.classNote.update({
        where: { id: noteId },
        data: { content },
      });
      return mapRow(row);
    },

    async deleteById(noteId) {
      const existing = await database.classNote.findUnique({
        where: { id: noteId },
        select: { id: true },
      });
      if (!existing) return false;
      await database.classNote.delete({ where: { id: noteId } });
      return true;
    },
  };
}
