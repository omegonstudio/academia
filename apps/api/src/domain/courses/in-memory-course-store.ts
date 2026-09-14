import { randomUUID } from 'node:crypto';
import type { CourseRecord, CourseStore } from './course-service.js';

export interface InMemoryCourseStore extends CourseStore {
  clear(): void;
}

export function createInMemoryCourseStore(): InMemoryCourseStore {
  const byId = new Map<string, CourseRecord>();

  function clone(record: CourseRecord): CourseRecord {
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
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async findById(id) {
      const row = byId.get(id);
      return row ? clone(row) : null;
    },

    async create(input) {
      const now = new Date();
      const record: CourseRecord = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        courseType: input.courseType,
        serviceType: input.serviceType,
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
      const next: CourseRecord = {
        ...current,
        name: patch.name ?? current.name,
        description:
          patch.description !== undefined
            ? patch.description
            : current.description,
        courseType: patch.courseType ?? current.courseType,
        serviceType: patch.serviceType ?? current.serviceType,
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
