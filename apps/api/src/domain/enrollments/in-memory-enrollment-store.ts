import { randomUUID } from 'node:crypto';
import {
  EnrollmentNotFoundError,
  EnrollmentValidationError,
  type EnrollmentRecord,
  type EnrollmentStore,
} from './enrollment-service.js';

export interface InMemoryEnrollmentStore extends EnrollmentStore {
  clear(): void;
}

export function createInMemoryEnrollmentStore(deps?: {
  findGroup?: EnrollmentStore['findGroup'];
  findStudent?: EnrollmentStore['findStudent'];
}): InMemoryEnrollmentStore {
  const byKey = new Map<string, EnrollmentRecord>();
  const groupLocks = new Map<string, Promise<unknown>>();

  function key(groupId: string, studentId: string): string {
    return `${groupId}:${studentId}`;
  }

  function clone(record: EnrollmentRecord): EnrollmentRecord {
    return { ...record };
  }

  async function withGroupLock<T>(
    groupId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const previous = groupLocks.get(groupId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = previous.then(() => gate);
    groupLocks.set(groupId, current);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (groupLocks.get(groupId) === current) {
        groupLocks.delete(groupId);
      }
    }
  }

  return {
    clear() {
      byKey.clear();
    },

    async findGroup(groupId) {
      if (deps?.findGroup) return deps.findGroup(groupId);
      return null;
    },

    async findStudent(studentId) {
      if (deps?.findStudent) return deps.findStudent(studentId);
      return null;
    },

    async listActiveByGroup(groupId) {
      return [...byKey.values()]
        .filter((row) => row.groupId === groupId && row.isActive)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(clone);
    },

    async findByGroupAndStudent(groupId, studentId) {
      const row = byKey.get(key(groupId, studentId));
      return row ? clone(row) : null;
    },

    async enrollActive(groupId, studentId, maxActive) {
      return withGroupLock(groupId, async () => {
        const group = deps?.findGroup
          ? await deps.findGroup(groupId)
          : null;
        if (!group) {
          throw new EnrollmentNotFoundError('Group not found.');
        }
        if (!group.isActive) {
          throw new EnrollmentValidationError('Group is inactive.');
        }

        const existing = byKey.get(key(groupId, studentId));
        if (existing?.isActive) {
          throw new EnrollmentValidationError(
            'Student is already enrolled in this group.',
          );
        }

        const activeCount = [...byKey.values()].filter(
          (row) => row.groupId === groupId && row.isActive,
        ).length;
        if (activeCount >= maxActive) {
          throw new EnrollmentValidationError(
            `Group is full (maximum ${maxActive} students).`,
          );
        }

        const now = new Date();
        if (existing) {
          const next: EnrollmentRecord = {
            ...existing,
            isActive: true,
            updatedAt: now,
          };
          byKey.set(key(groupId, studentId), next);
          return clone(next);
        }

        const created: EnrollmentRecord = {
          id: randomUUID(),
          groupId,
          studentId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        byKey.set(key(groupId, studentId), created);
        return clone(created);
      });
    },

    async softUnenroll(groupId, studentId) {
      const existing = byKey.get(key(groupId, studentId));
      if (!existing || !existing.isActive) return null;
      const next: EnrollmentRecord = {
        ...existing,
        isActive: false,
        updatedAt: new Date(),
      };
      byKey.set(key(groupId, studentId), next);
      return clone(next);
    },
  };
}
