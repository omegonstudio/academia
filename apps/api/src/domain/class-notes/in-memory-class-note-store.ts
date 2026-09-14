import { randomUUID } from 'node:crypto';
import type {
  ClassNoteClassSessionRef,
  ClassNoteRecord,
  ClassNoteStore,
} from './class-note-service.js';

export interface InMemoryClassNoteStore extends ClassNoteStore {
  clear(): void;
  seed(record: ClassNoteRecord): void;
}

export interface InMemoryClassNoteDeps {
  findClassSession: (
    id: string,
  ) => Promise<ClassNoteClassSessionRef | null>;
}

export function createInMemoryClassNoteStore(
  deps: InMemoryClassNoteDeps,
): InMemoryClassNoteStore {
  const byId = new Map<string, ClassNoteRecord>();

  function clone(record: ClassNoteRecord): ClassNoteRecord {
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  return {
    clear() {
      byId.clear();
    },

    seed(record) {
      byId.set(record.id, clone(record));
    },

    findClassSession: deps.findClassSession,

    async listByClassSession(classSessionId) {
      return [...byId.values()]
        .filter((row) => row.classSessionId === classSessionId)
        .sort((a, b) => {
          const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
          if (byCreated !== 0) return byCreated;
          return a.id.localeCompare(b.id);
        })
        .map(clone);
    },

    async findById(noteId) {
      const row = byId.get(noteId);
      return row ? clone(row) : null;
    },

    async create(input) {
      const now = new Date();
      const record: ClassNoteRecord = {
        id: randomUUID(),
        classSessionId: input.classSessionId,
        content: input.content,
        createdAt: now,
        updatedAt: now,
      };
      byId.set(record.id, record);
      return clone(record);
    },

    async updateContent(noteId, content) {
      const existing = byId.get(noteId);
      if (!existing) return null;
      const updated: ClassNoteRecord = {
        ...existing,
        content,
        updatedAt: new Date(),
      };
      byId.set(noteId, updated);
      return clone(updated);
    },

    async deleteById(noteId) {
      return byId.delete(noteId);
    },
  };
}
