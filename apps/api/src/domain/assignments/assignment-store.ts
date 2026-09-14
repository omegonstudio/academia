import type { Database } from '../../lib/prisma.js';
import type {
  AssignmentRecord,
  TeacherAssignmentStore,
} from './assignment-service.js';

function mapRow(row: {
  studentId: string;
  teacherId: string;
  createdAt: Date;
  updatedAt: Date;
}): AssignmentRecord {
  return {
    studentId: row.studentId,
    teacherId: row.teacherId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createTeacherAssignmentStore(
  database: Database,
): TeacherAssignmentStore {
  return {
    async findByStudentId(studentId) {
      const row = await database.teacherAssignment.findUnique({
        where: { studentId },
      });
      return row ? mapRow(row) : null;
    },

    async findStudent(id) {
      const row = await database.student.findUnique({
        where: { id },
        select: { id: true, userId: true, isActive: true },
      });
      return row;
    },

    async findTeacher(id) {
      const row = await database.teacher.findUnique({
        where: { id },
        select: { id: true, userId: true, isActive: true },
      });
      return row;
    },

    async upsert(studentId, teacherId) {
      const now = new Date();
      const row = await database.teacherAssignment.upsert({
        where: { studentId },
        create: { studentId, teacherId },
        update: { teacherId, updatedAt: now },
      });
      return mapRow(row);
    },

    async deleteByStudentId(studentId) {
      const existing = await database.teacherAssignment.findUnique({
        where: { studentId },
        select: { id: true },
      });
      if (!existing) return false;
      await database.teacherAssignment.delete({ where: { studentId } });
      return true;
    },
  };
}
