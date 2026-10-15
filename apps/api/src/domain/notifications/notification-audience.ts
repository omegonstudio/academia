import type { Database } from '../../lib/prisma.js';

export interface NotificationAudience {
  userId: string;
  email: string;
  displayName: string;
}

/**
 * Resolves emails / user ids needed by notification hooks without coupling
 * domain services to Prisma details.
 */
export function createNotificationAudience(database: Database) {
  return {
    async userById(userId: string): Promise<NotificationAudience | null> {
      const row = await database.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      });
      if (!row) return null;
      return {
        userId: row.id,
        email: row.email,
        displayName: row.name?.trim() || row.email,
      };
    },

    async studentById(
      studentId: string,
    ): Promise<NotificationAudience | null> {
      const row = await database.student.findUnique({
        where: { id: studentId },
        select: {
          firstName: true,
          lastName: true,
          user: { select: { id: true, email: true, name: true } },
        },
      });
      if (!row) return null;
      const displayName =
        `${row.firstName} ${row.lastName}`.trim() ||
        row.user.name?.trim() ||
        row.user.email;
      return {
        userId: row.user.id,
        email: row.user.email,
        displayName,
      };
    },

    async teacherById(
      teacherId: string,
    ): Promise<NotificationAudience | null> {
      const row = await database.teacher.findUnique({
        where: { id: teacherId },
        select: {
          firstName: true,
          lastName: true,
          user: { select: { id: true, email: true, name: true } },
        },
      });
      if (!row) return null;
      const displayName =
        `${row.firstName} ${row.lastName}`.trim() ||
        row.user.name?.trim() ||
        row.user.email;
      return {
        userId: row.user.id,
        email: row.user.email,
        displayName,
      };
    },

    async classSessionRecipients(
      classSessionId: string,
    ): Promise<NotificationAudience[]> {
      const session = await database.classSession.findUnique({
        where: { id: classSessionId },
        select: {
          group: {
            select: {
              teacher: {
                select: {
                  firstName: true,
                  lastName: true,
                  user: { select: { id: true, email: true, name: true } },
                },
              },
              enrollments: {
                where: { isActive: true },
                select: {
                  student: {
                    select: {
                      firstName: true,
                      lastName: true,
                      user: { select: { id: true, email: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!session) return [];

      const out: NotificationAudience[] = [];
      const teacher = session.group.teacher;
      if (teacher) {
        out.push({
          userId: teacher.user.id,
          email: teacher.user.email,
          displayName:
            `${teacher.firstName} ${teacher.lastName}`.trim() ||
            teacher.user.name?.trim() ||
            teacher.user.email,
        });
      }
      for (const enrollment of session.group.enrollments) {
        const student = enrollment.student;
        out.push({
          userId: student.user.id,
          email: student.user.email,
          displayName:
            `${student.firstName} ${student.lastName}`.trim() ||
            student.user.name?.trim() ||
            student.user.email,
        });
      }

      const seen = new Set<string>();
      return out.filter((item) => {
        if (seen.has(item.userId)) return false;
        seen.add(item.userId);
        return true;
      });
    },
  };
}

export type NotificationAudienceResolver = ReturnType<
  typeof createNotificationAudience
>;
