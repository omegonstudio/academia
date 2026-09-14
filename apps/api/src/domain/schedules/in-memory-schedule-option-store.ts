import { randomUUID } from 'node:crypto';
import type { Weekday } from '@academia/shared';
import type {
  ScheduleOptionRecord,
  ScheduleOptionStore,
} from './schedule-option-service.js';

export interface InMemoryScheduleOptionStore extends ScheduleOptionStore {
  clear(): void;
}

export function createInMemoryScheduleOptionStore(): InMemoryScheduleOptionStore {
  const byId = new Map<string, ScheduleOptionRecord>();

  function clone(record: ScheduleOptionRecord): ScheduleOptionRecord {
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

    async list() {
      return [...byId.values()]
        .map(clone)
        .sort((a, b) =>
          a.day === b.day
            ? a.startTime.localeCompare(b.startTime)
            : a.day.localeCompare(b.day),
        );
    },

    async findById(id) {
      const row = byId.get(id);
      return row ? clone(row) : null;
    },

    async create(input) {
      const now = new Date();
      const record: ScheduleOptionRecord = {
        id: randomUUID(),
        day: input.day as Weekday,
        startTime: input.startTime,
        endTime: input.endTime,
        isActive: input.isActive,
        createdAt: now,
        updatedAt: now,
      };
      byId.set(record.id, record);
      return clone(record);
    },

    async update(id, patch) {
      const current = byId.get(id);
      if (!current) throw new Error('missing');
      const next: ScheduleOptionRecord = {
        ...current,
        day: patch.day ?? current.day,
        startTime: patch.startTime ?? current.startTime,
        endTime: patch.endTime ?? current.endTime,
        isActive: patch.isActive ?? current.isActive,
        updatedAt: new Date(),
      };
      byId.set(id, next);
      return clone(next);
    },

    async softDelete(id) {
      return this.update(id, { isActive: false });
    },
  };
}
