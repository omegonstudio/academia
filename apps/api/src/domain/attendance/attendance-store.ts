import {
  isAttendanceStatus,
  type AttendanceStatus,
} from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import {
  AttendanceAlreadyExistsError,
  type AttendanceListFilter,
  type AttendanceRecord,
  type AttendanceStore,
} from './attendance-service.js';

type DbClient = Pick<
  Database,
  'attendance' | 'classSession' | 'student' | 'enrollment'
>;

function mapStatus(raw: string): AttendanceStatus {
  if (!isAttendanceStatus(raw)) {
    throw new Error(`Invalid attendance status in database: ${raw}`);
  }
  return raw;
}

function mapRow(row: {
  id: string;
  classSessionId: string;
  studentId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string };
}): AttendanceRecord {
  return {
    id: row.id,
    classSessionId: row.classSessionId,
    studentId: row.studentId,
    status: mapStatus(row.status),
    student: {
      id: row.student.id,
      firstName: row.student.firstName,
      lastName: row.student.lastName,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const studentSelect = {
  id: true,
  firstName: true,
  lastName: true,
} as const;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

export function createAttendanceStore(database: DbClient): AttendanceStore {
  return {
    async findClassSession(classSessionId) {
      const row = await database.classSession.findUnique({
        where: { id: classSessionId },
        select: {
          id: true,
          groupId: true,
          isActive: true,
          group: { select: { teacherId: true } },
        },
      });
      if (!row) return null;
      return {
        id: row.id,
        groupId: row.groupId,
        isActive: row.isActive,
        teacherId: row.group.teacherId,
      };
    },

    async findStudent(studentId) {
      const row = await database.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });
      return row;
    },

    async hasActiveEnrollment(groupId, studentId) {
      const row = await database.enrollment.findFirst({
        where: { groupId, studentId, isActive: true },
        select: { id: true },
      });
      return row !== null;
    },

    async listByClassSession(classSessionId, filter?: AttendanceListFilter) {
      const rows = await database.attendance.findMany({
        where: {
          classSessionId,
          ...(filter?.studentId ? { studentId: filter.studentId } : {}),
        },
        include: { student: { select: studentSelect } },
        orderBy: [
          { student: { lastName: 'asc' } },
          { student: { firstName: 'asc' } },
          { studentId: 'asc' },
        ],
      });
      return rows.map(mapRow);
    },

    async findByClassSessionAndStudent(classSessionId, studentId) {
      const row = await database.attendance.findUnique({
        where: {
          classSessionId_studentId: { classSessionId, studentId },
        },
        include: { student: { select: studentSelect } },
      });
      return row ? mapRow(row) : null;
    },

    async create(input) {
      try {
        const row = await database.attendance.create({
          data: {
            classSessionId: input.classSessionId,
            studentId: input.studentId,
            status: input.status,
          },
          include: { student: { select: studentSelect } },
        });
        return mapRow(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AttendanceAlreadyExistsError();
        }
        throw error;
      }
    },

    async updateStatus(classSessionId, studentId, status) {
      const existing = await database.attendance.findUnique({
        where: {
          classSessionId_studentId: { classSessionId, studentId },
        },
        select: { id: true },
      });
      if (!existing) return null;

      const row = await database.attendance.update({
        where: { id: existing.id },
        data: { status },
        include: { student: { select: studentSelect } },
      });
      return mapRow(row);
    },
  };
}
