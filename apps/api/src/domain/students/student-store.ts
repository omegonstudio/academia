import type {
  StudentLevel,
} from '@academia/shared';
import { normalizeEmail } from '../identity/user-repository.js';
import type { Database } from '../../lib/prisma.js';
import type { StudentRecord, StudentStore } from './student-service.js';

function mapRow(row: {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  level: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string };
}): StudentRecord {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    firstName: row.firstName,
    lastName: row.lastName,
    level: row.level as StudentLevel,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const studentInclude = {
  user: { select: { email: true } },
} as const;

export function createStudentStore(database: Database): StudentStore {
  return {
    async list() {
      const rows = await database.student.findMany({
        include: studentInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async findById(id) {
      const row = await database.student.findUnique({
        where: { id },
        include: studentInclude,
      });
      return row ? mapRow(row) : null;
    },

    async findByUserId(userId) {
      const row = await database.student.findUnique({
        where: { userId },
        include: studentInclude,
      });
      return row ? mapRow(row) : null;
    },

    async findUserByEmail(email) {
      const normalized = normalizeEmail(email);
      const user = await database.user.findUnique({
        where: { email: normalized },
        select: {
          id: true,
          email: true,
          role: true,
          student: { select: { id: true } },
        },
      });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        hasStudent: user.student !== null,
      };
    },

    async createWithNewUser(input) {
      const displayName = `${input.firstName} ${input.lastName}`.trim();
      const created = await database.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizeEmail(input.email),
            name: displayName,
            passwordHash: input.passwordHash,
            role: 'STUDENT',
            isActive: input.isActive,
          },
        });
        return tx.student.create({
          data: {
            userId: user.id,
            firstName: input.firstName,
            lastName: input.lastName,
            level: input.level,
            isActive: input.isActive,
          },
          include: studentInclude,
        });
      });
      return mapRow(created);
    },

    async createForExistingUser(input) {
      const displayName = `${input.firstName} ${input.lastName}`.trim();
      const created = await database.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: input.userId },
          data: {
            name: displayName,
            isActive: input.isActive,
          },
        });
        return tx.student.create({
          data: {
            userId: input.userId,
            firstName: input.firstName,
            lastName: input.lastName,
            level: input.level,
            isActive: input.isActive,
          },
          include: studentInclude,
        });
      });
      return mapRow(created);
    },

    async update(id, patch) {
      const data: {
        firstName?: string;
        lastName?: string;
        level?: string;
        isActive?: boolean;
      } = {};
      if (patch.firstName !== undefined) data.firstName = patch.firstName;
      if (patch.lastName !== undefined) data.lastName = patch.lastName;
      if (patch.level !== undefined) data.level = patch.level;
      if (patch.isActive !== undefined) data.isActive = patch.isActive;

      const updated = await database.$transaction(async (tx) => {
        const student = await tx.student.update({
          where: { id },
          data,
          include: studentInclude,
        });

        const userPatch: { name?: string; isActive?: boolean } = {};
        if (patch.firstName !== undefined || patch.lastName !== undefined) {
          userPatch.name =
            `${student.firstName} ${student.lastName}`.trim();
        }
        if (patch.isActive !== undefined) {
          userPatch.isActive = patch.isActive;
        }
        if (Object.keys(userPatch).length > 0) {
          await tx.user.update({
            where: { id: student.userId },
            data: userPatch,
          });
        }

        return student;
      });
      return mapRow(updated);
    },

    async softDelete(id) {
      const updated = await database.$transaction(async (tx) => {
        const student = await tx.student.update({
          where: { id },
          data: { isActive: false },
          include: studentInclude,
        });
        await tx.user.update({
          where: { id: student.userId },
          data: { isActive: false },
        });
        return student;
      });
      return mapRow(updated);
    },
  };
}
