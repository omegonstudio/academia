import { randomUUID } from 'node:crypto';
import type {
  MaterialRecord,
  MaterialStore,
} from './material-service.js';

export interface InMemoryMaterialAssociation {
  courseId?: string;
  courseIsActive?: boolean;
  classSessionId?: string;
  sessionGroupId?: string;
  sessionIsActive?: boolean;
  sessionGroupIsActive?: boolean;
  sessionTeacherId?: string | null;
}

export interface InMemoryMaterialDeps {
  associations: Map<string, InMemoryMaterialAssociation>;
  teacherCourses: Map<string, Set<string>>;
  teacherSessions: Map<string, Set<string>>;
  studentCourses: Map<string, Set<string>>;
  studentSessions: Map<string, Set<string>>;
}

export interface InMemoryMaterialStore extends MaterialStore {
  records: Map<string, MaterialRecord>;
  deps: InMemoryMaterialDeps;
  seed(record: MaterialRecord): void;
  seedCourse(courseId: string, options?: { isActive?: boolean }): void;
  seedClassSession(
    classSessionId: string,
    options?: {
      groupId?: string;
      teacherId?: string | null;
      isActive?: boolean;
      groupIsActive?: boolean;
    },
  ): void;
  clear(): void;
}

export function createInMemoryMaterialStore(
  deps?: Partial<InMemoryMaterialDeps>,
): InMemoryMaterialStore {
  const records = new Map<string, MaterialRecord>();
  const state: InMemoryMaterialDeps = {
    associations: deps?.associations ?? new Map(),
    teacherCourses: deps?.teacherCourses ?? new Map(),
    teacherSessions: deps?.teacherSessions ?? new Map(),
    studentCourses: deps?.studentCourses ?? new Map(),
    studentSessions: deps?.studentSessions ?? new Map(),
  };

  const store: InMemoryMaterialStore = {
    records,
    deps: state,

    seed(record) {
      records.set(record.id, { ...record });
    },

    seedCourse(courseId, options) {
      state.associations.set(`course:${courseId}`, {
        courseId,
        courseIsActive: options?.isActive ?? true,
      });
    },

    seedClassSession(classSessionId, options) {
      state.associations.set(`session:${classSessionId}`, {
        classSessionId,
        sessionGroupId: options?.groupId ?? 'group-default',
        sessionIsActive: options?.isActive ?? true,
        sessionGroupIsActive: options?.groupIsActive ?? true,
        sessionTeacherId: options?.teacherId ?? null,
      });
      if (options?.teacherId) {
        let set = state.teacherSessions.get(options.teacherId);
        if (!set) {
          set = new Set();
          state.teacherSessions.set(options.teacherId, set);
        }
        set.add(classSessionId);
      }
    },

    clear() {
      records.clear();
      state.associations.clear();
      state.teacherCourses.clear();
      state.teacherSessions.clear();
      state.studentCourses.clear();
      state.studentSessions.clear();
    },

    async findById(id) {
      return records.get(id) ?? null;
    },

    async list(filter) {
      const rows = [...records.values()].filter((row) => {
        if (!row.isActive) return false;
        if (filter.courseId && row.courseId !== filter.courseId) return false;
        if (
          filter.classSessionId &&
          row.classSessionId !== filter.classSessionId
        ) {
          return false;
        }

        if (filter.actor.mode === 'admin') return true;

        if (filter.actor.mode === 'teacher') {
          if (row.courseId) {
            return (
              state.teacherCourses
                .get(filter.actor.teacherId)
                ?.has(row.courseId) === true
            );
          }
          if (row.classSessionId) {
            return (
              state.teacherSessions
                .get(filter.actor.teacherId)
                ?.has(row.classSessionId) === true
            );
          }
          return false;
        }

        if (row.uploadStatus !== 'READY') return false;
        if (row.courseId) {
          return (
            state.studentCourses
              .get(filter.actor.studentId)
              ?.has(row.courseId) === true
          );
        }
        if (row.classSessionId) {
          return (
            state.studentSessions
              .get(filter.actor.studentId)
              ?.has(row.classSessionId) === true
          );
        }
        return false;
      });

      return rows.sort((a, b) => {
        const byDate = b.createdAt.getTime() - a.createdAt.getTime();
        if (byDate !== 0) return byDate;
        return a.id.localeCompare(b.id);
      });
    },

    async create(input) {
      const now = new Date();
      const record: MaterialRecord = {
        id: randomUUID(),
        title: input.title,
        description: input.description,
        kind: input.kind,
        uploadStatus: input.uploadStatus,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
        originalFilename: input.originalFilename,
        externalUrl: input.externalUrl,
        courseId: input.courseId,
        classSessionId: input.classSessionId,
        createdByUserId: input.createdByUserId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      records.set(record.id, record);
      return { ...record };
    },

    async updateMetadata(id, patch) {
      const existing = records.get(id);
      if (!existing) return null;
      const updated: MaterialRecord = {
        ...existing,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
        updatedAt: new Date(),
      };
      records.set(id, updated);
      return { ...updated };
    },

    async markReady(id, sizeBytes) {
      const existing = records.get(id);
      if (!existing) return null;
      const updated: MaterialRecord = {
        ...existing,
        uploadStatus: 'READY',
        sizeBytes,
        updatedAt: new Date(),
      };
      records.set(id, updated);
      return { ...updated };
    },

    async softDelete(id) {
      const existing = records.get(id);
      if (!existing) return null;
      const updated: MaterialRecord = {
        ...existing,
        isActive: false,
        updatedAt: new Date(),
      };
      records.set(id, updated);
      return { ...updated };
    },

    async resolveAssociation(input) {
      if (input.courseId) {
        const assoc = state.associations.get(`course:${input.courseId}`);
        if (!assoc) return null;
        return {
          courseId: input.courseId,
          classSessionId: null,
          sessionGroupId: null,
          sessionIsActive: true,
          sessionGroupIsActive: true,
          sessionTeacherId: null,
          courseIsActive: assoc.courseIsActive ?? true,
        };
      }
      if (input.classSessionId) {
        const assoc = state.associations.get(`session:${input.classSessionId}`);
        if (!assoc) return null;
        return {
          courseId: null,
          classSessionId: input.classSessionId,
          sessionGroupId: assoc.sessionGroupId ?? null,
          sessionIsActive: assoc.sessionIsActive ?? true,
          sessionGroupIsActive: assoc.sessionGroupIsActive ?? true,
          sessionTeacherId: assoc.sessionTeacherId ?? null,
          courseIsActive: true,
        };
      }
      return null;
    },

    async teacherOwnsCourse(teacherId, courseId) {
      return state.teacherCourses.get(teacherId)?.has(courseId) === true;
    },

    async teacherOwnsClassSession(teacherId, classSessionId) {
      return state.teacherSessions.get(teacherId)?.has(classSessionId) === true;
    },

    async studentEntitledToCourse(studentId, courseId) {
      return state.studentCourses.get(studentId)?.has(courseId) === true;
    },

    async studentEntitledToClassSession(studentId, classSessionId) {
      return state.studentSessions.get(studentId)?.has(classSessionId) === true;
    },
  };

  return store;
}
