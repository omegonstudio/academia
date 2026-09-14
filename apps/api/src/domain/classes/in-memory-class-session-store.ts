import { randomUUID } from 'node:crypto';
import type {
  ClassSessionCalendarRecord,
  ClassSessionGroupContext,
  ClassSessionReadScope,
  ClassSessionRecord,
  ClassSessionStore,
} from './class-session-service.js';

export interface InMemoryClassSessionStore extends ClassSessionStore {
  clear(): void;
  seedGroupContext(context: ClassSessionGroupContext): void;
  /** Extra calendar join fields not needed for CRUD contexts. */
  seedCalendarGroup(meta: {
    id: string;
    name: string;
    course: ClassSessionCalendarRecord['group']['course'];
    teacher: ClassSessionCalendarRecord['teacher'];
  }): void;
}

function sessionKey(groupId: string, startAt: Date): string {
  return `${groupId}:${startAt.toISOString()}`;
}

export function createInMemoryClassSessionStore(deps?: {
  findGroupContext?: ClassSessionStore['findGroupContext'];
  hasActiveEnrollment?: ClassSessionStore['hasActiveEnrollment'];
  resolveCalendarMeta?: (
    groupId: string,
  ) => Promise<{
    name: string;
    course: ClassSessionCalendarRecord['group']['course'];
    teacher: ClassSessionCalendarRecord['teacher'];
  } | null>;
}): InMemoryClassSessionStore {
  const byId = new Map<string, ClassSessionRecord>();
  const byGroupStart = new Map<string, string>();
  const groups = new Map<string, ClassSessionGroupContext>();
  const calendarMeta = new Map<
    string,
    {
      name: string;
      course: ClassSessionCalendarRecord['group']['course'];
      teacher: ClassSessionCalendarRecord['teacher'];
    }
  >();

  function clone(record: ClassSessionRecord): ClassSessionRecord {
    return {
      ...record,
      startAt: new Date(record.startAt),
      endAt: new Date(record.endAt),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  async function matchesScope(
    groupId: string,
    scope: ClassSessionReadScope | undefined,
  ): Promise<boolean> {
    if (!scope || scope.mode === 'all') return true;
    if (scope.mode === 'teacher') {
      const context =
        (await deps?.findGroupContext?.(groupId)) ?? groups.get(groupId) ?? null;
      return context?.teacherId === scope.teacherId;
    }
    if (deps?.hasActiveEnrollment) {
      return deps.hasActiveEnrollment(groupId, scope.studentId);
    }
    return false;
  }

  const store: InMemoryClassSessionStore = {
    clear() {
      byId.clear();
      byGroupStart.clear();
      groups.clear();
      calendarMeta.clear();
    },

    seedGroupContext(context) {
      groups.set(context.id, { ...context });
    },

    seedCalendarGroup(meta) {
      calendarMeta.set(meta.id, {
        name: meta.name,
        course: { ...meta.course },
        teacher: meta.teacher ? { ...meta.teacher } : null,
      });
    },

    async list(filter) {
      const results: ClassSessionRecord[] = [];
      for (const row of byId.values()) {
        if (filter?.groupId && row.groupId !== filter.groupId) continue;
        if (!(await matchesScope(row.groupId, filter?.scope))) continue;
        results.push(clone(row));
      }
      return results.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    },

    async findById(id) {
      const row = byId.get(id);
      return row ? clone(row) : null;
    },

    async findGroupContext(groupId) {
      if (deps?.findGroupContext) return deps.findGroupContext(groupId);
      return groups.get(groupId) ?? null;
    },

    async hasActiveEnrollment(groupId, studentId) {
      if (deps?.hasActiveEnrollment) {
        return deps.hasActiveEnrollment(groupId, studentId);
      }
      return false;
    },

    async listCalendarRange(input) {
      const results: ClassSessionCalendarRecord[] = [];
      for (const row of byId.values()) {
        if (!row.isActive) continue;
        if (
          row.startAt < input.rangeStart ||
          !(row.startAt < input.rangeEndExclusive)
        ) {
          continue;
        }
        if (!(await matchesScope(row.groupId, input.scope))) continue;
        const context = await store.findGroupContext(row.groupId);
        if (!context) continue;
        const meta =
          (await deps?.resolveCalendarMeta?.(row.groupId)) ??
          calendarMeta.get(row.groupId) ??
          null;
        if (!meta) continue;
        results.push({
          id: row.id,
          startAt: new Date(row.startAt),
          endAt: new Date(row.endAt),
          meetingUrl: row.meetingUrl,
          group: {
            id: context.id,
            name: meta.name,
            course: { ...meta.course },
          },
          teacher: meta.teacher ? { ...meta.teacher } : null,
        });
      }
      return results.sort((a, b) => {
        const byStart = a.startAt.getTime() - b.startAt.getTime();
        if (byStart !== 0) return byStart;
        return a.id.localeCompare(b.id);
      });
    },

    async findActiveOverlappingForTeacher(input) {
      for (const row of byId.values()) {
        if (!row.isActive) continue;
        if (input.excludeSessionId && row.id === input.excludeSessionId) {
          continue;
        }
        if (!(row.startAt < input.endAt && row.endAt > input.startAt)) {
          continue;
        }
        const context = await store.findGroupContext(row.groupId);
        if (!context || context.teacherId !== input.teacherId) continue;
        return clone(row);
      }
      return null;
    },

    async withTeacherScheduleLock(_teacherId, fn) {
      return fn(store);
    },

    async create(input) {
      const key = sessionKey(input.groupId, input.startAt);
      if (byGroupStart.has(key)) {
        throw new Error('duplicate groupId+startAt');
      }
      const now = new Date();
      const record: ClassSessionRecord = {
        id: randomUUID(),
        groupId: input.groupId,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        meetingUrl: input.meetingUrl,
        isActive: input.isActive,
        createdAt: now,
        updatedAt: now,
      };
      byId.set(record.id, record);
      byGroupStart.set(key, record.id);
      return clone(record);
    },

    async createManySkippingDuplicates(inputs) {
      const created: ClassSessionRecord[] = [];
      let skippedCount = 0;
      for (const input of inputs) {
        const key = sessionKey(input.groupId, input.startAt);
        if (byGroupStart.has(key)) {
          skippedCount += 1;
          continue;
        }
        created.push(await store.create(input));
      }
      return { created, skippedCount };
    },

    async update(id, patch) {
      const current = byId.get(id);
      if (!current) throw new Error('missing');
      const nextStart =
        patch.startAt !== undefined ? new Date(patch.startAt) : current.startAt;
      const oldKey = sessionKey(current.groupId, current.startAt);
      const newKey = sessionKey(current.groupId, nextStart);
      if (oldKey !== newKey) {
        if (byGroupStart.has(newKey)) {
          throw new Error('duplicate groupId+startAt');
        }
        byGroupStart.delete(oldKey);
        byGroupStart.set(newKey, id);
      }
      const next: ClassSessionRecord = {
        ...current,
        startAt: nextStart,
        endAt:
          patch.endAt !== undefined ? new Date(patch.endAt) : current.endAt,
        meetingUrl:
          patch.meetingUrl !== undefined
            ? patch.meetingUrl
            : current.meetingUrl,
        isActive: patch.isActive ?? current.isActive,
        updatedAt: new Date(),
      };
      byId.set(id, next);
      return clone(next);
    },

    async softDelete(id) {
      return store.update(id, { isActive: false });
    },
  };

  return store;
}
