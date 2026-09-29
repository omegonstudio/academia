import type { Database } from '../../lib/prisma.js';
import type {
  TeacherRelatedStudentRaw,
  TeacherRelatedStudentsStore,
} from './teacher-related-students.js';

type DbClient = Pick<
  Database,
  'teacherAssignment' | 'enrollment' | 'student'
>;

/**
 * Union of:
 * - students with TeacherAssignment to this teacher
 * - students with active Enrollment in a Group taught by this teacher
 */
export function createTeacherRelatedStudentsStore(
  database: DbClient,
): TeacherRelatedStudentsStore {
  return {
    async listRelatedStudents(teacherId) {
      const [assignments, enrollments] = await Promise.all([
        database.teacherAssignment.findMany({
          where: { teacherId },
          select: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                level: true,
                isActive: true,
                user: { select: { email: true } },
              },
            },
          },
        }),
        database.enrollment.findMany({
          where: {
            isActive: true,
            group: { teacherId, isActive: true },
          },
          select: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                level: true,
                isActive: true,
                user: { select: { email: true } },
              },
            },
            group: {
              select: {
                id: true,
                name: true,
                course: {
                  select: {
                    id: true,
                    name: true,
                    serviceType: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const byId = new Map<string, TeacherRelatedStudentRaw>();

      for (const row of assignments) {
        const student = row.student;
        byId.set(student.id, {
          id: student.id,
          email: student.user.email,
          firstName: student.firstName,
          lastName: student.lastName,
          level: student.level,
          isActive: student.isActive,
          viaAssignment: true,
          groups: [],
        });
      }

      for (const row of enrollments) {
        const student = row.student;
        const existing = byId.get(student.id);
        const groupEntry = {
          id: row.group.id,
          name: row.group.name,
          course: {
            id: row.group.course.id,
            name: row.group.course.name,
            serviceType: row.group.course.serviceType,
          },
        };
        if (existing) {
          if (!existing.groups.some((g) => g.id === groupEntry.id)) {
            existing.groups.push(groupEntry);
          }
        } else {
          byId.set(student.id, {
            id: student.id,
            email: student.user.email,
            firstName: student.firstName,
            lastName: student.lastName,
            level: student.level,
            isActive: student.isActive,
            viaAssignment: false,
            groups: [groupEntry],
          });
        }
      }

      return [...byId.values()];
    },
  };
}
