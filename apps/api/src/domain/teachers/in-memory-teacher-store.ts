import { randomUUID } from 'node:crypto';
import type { Role, TeacherAvailability, TeacherLevel } from '@academia/shared';
import { normalizeEmail } from '../identity/user-repository.js';
import type { TeacherRecord, TeacherStore } from './teacher-service.js';

export interface InMemoryTeacherUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface InMemoryTeacherStore extends TeacherStore {
  clear(): void;
}

export function createInMemoryTeacherStore(deps: {
  findUserByEmail: (email: string) => InMemoryTeacherUser | null;
  findUserById: (id: string) => InMemoryTeacherUser | null;
  createUser: (input: {
    email: string;
    name: string;
    passwordHash: string;
    role: Role;
    isActive: boolean;
  }) => InMemoryTeacherUser;
  updateUser: (
    id: string,
    patch: { name?: string; isActive?: boolean },
  ) => void;
}): InMemoryTeacherStore {
  const byId = new Map<string, TeacherRecord>();

  function clone(record: TeacherRecord): TeacherRecord {
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
          a.lastName === b.lastName
            ? a.firstName.localeCompare(b.firstName)
            : a.lastName.localeCompare(b.lastName),
        );
    },

    async findById(id) {
      const row = byId.get(id);
      return row ? clone(row) : null;
    },

    async findByUserId(userId) {
      for (const row of byId.values()) {
        if (row.userId === userId) return clone(row);
      }
      return null;
    },

    async findUserByEmail(email) {
      const user = deps.findUserByEmail(normalizeEmail(email));
      if (!user) return null;
      const hasTeacher = [...byId.values()].some((row) => row.userId === user.id);
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        hasTeacher,
      };
    },

    async createWithNewUser(input) {
      const user = deps.createUser({
        email: normalizeEmail(input.email),
        name: `${input.firstName} ${input.lastName}`.trim(),
        passwordHash: input.passwordHash,
        role: 'TEACHER',
        isActive: input.isActive,
      });
      const now = new Date();
      const record: TeacherRecord = {
        id: randomUUID(),
        userId: user.id,
        email: user.email,
        firstName: input.firstName,
        lastName: input.lastName,
        level: input.level,
        availability: input.availability,
        isActive: input.isActive,
        createdAt: now,
        updatedAt: now,
      };
      byId.set(record.id, record);
      return clone(record);
    },

    async createForExistingUser(input) {
      const user = deps.findUserById(input.userId);
      if (!user) throw new Error(`user ${input.userId} not found`);

      deps.updateUser(input.userId, {
        name: `${input.firstName} ${input.lastName}`.trim(),
        isActive: input.isActive,
      });
      const now = new Date();
      const record: TeacherRecord = {
        id: randomUUID(),
        userId: input.userId,
        email: user.email,
        firstName: input.firstName,
        lastName: input.lastName,
        level: input.level as TeacherLevel,
        availability: input.availability as TeacherAvailability,
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
      const next: TeacherRecord = {
        ...current,
        firstName: patch.firstName ?? current.firstName,
        lastName: patch.lastName ?? current.lastName,
        level: patch.level ?? current.level,
        availability: patch.availability ?? current.availability,
        isActive: patch.isActive ?? current.isActive,
        updatedAt: new Date(),
      };
      byId.set(id, next);
      deps.updateUser(next.userId, {
        name: `${next.firstName} ${next.lastName}`.trim(),
        isActive: next.isActive,
      });
      return clone(next);
    },

    async softDelete(id) {
      return this.update(id, { isActive: false });
    },
  };
}
