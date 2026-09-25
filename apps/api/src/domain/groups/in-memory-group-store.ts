import { randomUUID } from 'node:crypto';
import type { CourseRecord } from '../courses/course-service.js';
import type { GroupRecord, GroupStore } from './group-service.js';

export interface InMemoryGroupStore extends GroupStore {
  clear(): void;
  seedCourse(course: Pick<CourseRecord, 'id' | 'isActive'>): void;
  seedTeacher(teacher: { id: string; isActive: boolean }): void;
  seedScheduleOption(option: { id: string; isActive: boolean }): void;
}

export function createInMemoryGroupStore(deps?: {
  findCourse?: (
    id: string,
  ) => Promise<Pick<CourseRecord, 'id' | 'isActive'> | null>;
  findTeacher?: (
    id: string,
  ) => Promise<{ id: string; isActive: boolean } | null>;
  findScheduleOption?: (
    id: string,
  ) => Promise<{ id: string; isActive: boolean } | null>;
}): InMemoryGroupStore {
  const byId = new Map<string, GroupRecord>();
  const courses = new Map<string, Pick<CourseRecord, 'id' | 'isActive'>>();
  const teachers = new Map<string, { id: string; isActive: boolean }>();
  const schedules = new Map<string, { id: string; isActive: boolean }>();

  function clone(record: GroupRecord): GroupRecord {
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  return {
    clear() {
      byId.clear();
      courses.clear();
      teachers.clear();
      schedules.clear();
    },

    seedCourse(course) {
      courses.set(course.id, { id: course.id, isActive: course.isActive });
    },

    seedTeacher(teacher) {
      teachers.set(teacher.id, { ...teacher });
    },

    seedScheduleOption(option) {
      schedules.set(option.id, { ...option });
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

    async findCourse(courseId) {
      if (deps?.findCourse) return deps.findCourse(courseId);
      const row = courses.get(courseId);
      return row ? { ...row } : null;
    },

    async findTeacher(teacherId) {
      if (deps?.findTeacher) return deps.findTeacher(teacherId);
      const row = teachers.get(teacherId);
      return row ? { ...row } : null;
    },

    async findScheduleOption(scheduleOptionId) {
      if (deps?.findScheduleOption) {
        return deps.findScheduleOption(scheduleOptionId);
      }
      const row = schedules.get(scheduleOptionId);
      return row ? { ...row } : null;
    },

    async create(input) {
      const now = new Date();
      const record: GroupRecord = {
        id: randomUUID(),
        courseId: input.courseId,
        name: input.name,
        teacherId: null,
        scheduleOptionId: null,
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
      const next: GroupRecord = {
        ...current,
        name: patch.name ?? current.name,
        isActive: patch.isActive ?? current.isActive,
        teacherId:
          patch.teacherId !== undefined ? patch.teacherId : current.teacherId,
        scheduleOptionId:
          patch.scheduleOptionId !== undefined
            ? patch.scheduleOptionId
            : current.scheduleOptionId,
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
