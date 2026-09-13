import type {
  TeacherAvailability,
  TeacherLevel,
} from '@academia/shared';
import { normalizeEmail } from '../identity/user-repository.js';
import type { Database } from '../../lib/prisma.js';
import type { TeacherRecord, TeacherStore } from './teacher-service.js';

function mapRow(row: {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  level: string;
  availability: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string };
}): TeacherRecord {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    firstName: row.firstName,
    lastName: row.lastName,
    level: row.level as TeacherLevel,
    availability: row.availability as TeacherAvailability,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const teacherInclude = {
  user: { select: { email: true } },
} as const;

export function createTeacherStore(database: Database): TeacherStore {
  return {
    async list() {
      const rows = await database.teacher.findMany({
        include: teacherInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async findById(id) {
      const row = await database.teacher.findUnique({
        where: { id },
        include: teacherInclude,
      });
      return row ? mapRow(row) : null;
    },

    async findByUserId(userId) {
      const row = await database.teacher.findUnique({
        where: { userId },
        include: teacherInclude,
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
          teacher: { select: { id: true } },
        },
      });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        hasTeacher: user.teacher !== null,
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
            role: 'TEACHER',
            isActive: input.isActive,
          },
        });
        return tx.teacher.create({
          data: {
            userId: user.id,
            firstName: input.firstName,
            lastName: input.lastName,
            level: input.level,
            availability: input.availability,
            isActive: input.isActive,
          },
          include: teacherInclude,
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
        return tx.teacher.create({
          data: {
            userId: input.userId,
            firstName: input.firstName,
            lastName: input.lastName,
            level: input.level,
            availability: input.availability,
            isActive: input.isActive,
          },
          include: teacherInclude,
        });
      });
      return mapRow(created);
    },

    async update(id, patch) {
      const data: {
        firstName?: string;
        lastName?: string;
        level?: string;
        availability?: string;
        isActive?: boolean;
      } = {};
      if (patch.firstName !== undefined) data.firstName = patch.firstName;
      if (patch.lastName !== undefined) data.lastName = patch.lastName;
      if (patch.level !== undefined) data.level = patch.level;
      if (patch.availability !== undefined) {
        data.availability = patch.availability;
      }
      if (patch.isActive !== undefined) data.isActive = patch.isActive;

      const updated = await database.$transaction(async (tx) => {
        const teacher = await tx.teacher.update({
          where: { id },
          data,
          include: teacherInclude,
        });

        const userPatch: { name?: string; isActive?: boolean } = {};
        if (patch.firstName !== undefined || patch.lastName !== undefined) {
          userPatch.name = `${teacher.firstName} ${teacher.lastName}`.trim();
        }
        if (patch.isActive !== undefined) {
          userPatch.isActive = patch.isActive;
        }
        if (Object.keys(userPatch).length > 0) {
          await tx.user.update({
            where: { id: teacher.userId },
            data: userPatch,
          });
        }

        return teacher;
      });
      return mapRow(updated);
    },

    async softDelete(id) {
      const updated = await database.$transaction(async (tx) => {
        const teacher = await tx.teacher.update({
          where: { id },
          data: { isActive: false },
          include: teacherInclude,
        });
        await tx.user.update({
          where: { id: teacher.userId },
          data: { isActive: false },
        });
        return teacher;
      });
      return mapRow(updated);
    },
  };
}
