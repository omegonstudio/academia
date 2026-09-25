import type { Database } from '../../lib/prisma.js';
import {
  EnrollmentNotFoundError,
  EnrollmentValidationError,
  type EnrollmentRecord,
  type EnrollmentStore,
} from './enrollment-service.js';

function mapRow(row: {
  id: string;
  groupId: string;
  studentId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): EnrollmentRecord {
  return {
    id: row.id,
    groupId: row.groupId,
    studentId: row.studentId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createEnrollmentStore(database: Database): EnrollmentStore {
  return {
    async findGroup(groupId) {
      const row = await database.group.findUnique({
        where: { id: groupId },
        select: { id: true, isActive: true },
      });
      return row;
    },

    async findStudent(studentId) {
      const row = await database.student.findUnique({
        where: { id: studentId },
        select: { id: true, isActive: true },
      });
      return row;
    },

    async listActiveByGroup(groupId) {
      const rows = await database.enrollment.findMany({
        where: { groupId, isActive: true },
        orderBy: [{ createdAt: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async findByGroupAndStudent(groupId, studentId) {
      const row = await database.enrollment.findUnique({
        where: {
          groupId_studentId: { groupId, studentId },
        },
      });
      return row ? mapRow(row) : null;
    },

    async enrollActive(groupId, studentId, maxActive) {
      return database.$transaction(async (tx) => {
        // Serialize enrollments for this group so concurrent requests cannot
        // both pass a COUNT < max check (decision #26).
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "groups"
          WHERE id = CAST(${groupId} AS uuid)
          FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new EnrollmentNotFoundError('Group not found.');
        }

        const group = await tx.group.findUnique({
          where: { id: groupId },
          select: { id: true, isActive: true },
        });
        if (!group) {
          throw new EnrollmentNotFoundError('Group not found.');
        }
        if (!group.isActive) {
          throw new EnrollmentValidationError('Group is inactive.');
        }

        const existing = await tx.enrollment.findUnique({
          where: { groupId_studentId: { groupId, studentId } },
        });
        if (existing?.isActive) {
          throw new EnrollmentValidationError(
            'Student is already enrolled in this group.',
          );
        }

        const activeCount = await tx.enrollment.count({
          where: { groupId, isActive: true },
        });
        if (activeCount >= maxActive) {
          throw new EnrollmentValidationError(
            `Group is full (maximum ${maxActive} students).`,
          );
        }

        if (existing) {
          const row = await tx.enrollment.update({
            where: { id: existing.id },
            data: { isActive: true },
          });
          return mapRow(row);
        }

        const row = await tx.enrollment.create({
          data: { groupId, studentId, isActive: true },
        });
        return mapRow(row);
      });
    },

    async softUnenroll(groupId, studentId) {
      const existing = await database.enrollment.findUnique({
        where: { groupId_studentId: { groupId, studentId } },
      });
      if (!existing || !existing.isActive) return null;

      const row = await database.enrollment.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
      return mapRow(row);
    },
  };
}
