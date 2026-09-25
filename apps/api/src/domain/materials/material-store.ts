import type { Database } from '../../lib/prisma.js';
import type {
  MaterialKind,
  MaterialUploadStatus,
} from '@academia/shared';
import type {
  MaterialListFilter,
  MaterialRecord,
  MaterialStore,
} from './material-service.js';

type DbClient = Pick<Database, 'material' | 'course' | 'classSession' | 'group' | 'enrollment'>;

function mapRow(row: {
  id: string;
  title: string;
  description: string | null;
  kind: MaterialKind;
  uploadStatus: MaterialUploadStatus;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  originalFilename: string | null;
  externalUrl: string | null;
  courseId: string | null;
  classSessionId: string | null;
  createdByUserId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MaterialRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    uploadStatus: row.uploadStatus,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    originalFilename: row.originalFilename,
    externalUrl: row.externalUrl,
    courseId: row.courseId,
    classSessionId: row.classSessionId,
    createdByUserId: row.createdByUserId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Authorization predicates encoded in Prisma `where` so list never
 * load-all-then-filter for Student entitlement / Teacher ownership.
 */
function listWhere(filter: MaterialListFilter): Record<string, unknown> {
  const scope: Record<string, unknown> = {
    isActive: true,
    ...(filter.courseId ? { courseId: filter.courseId } : {}),
    ...(filter.classSessionId
      ? { classSessionId: filter.classSessionId }
      : {}),
  };

  if (filter.actor.mode === 'admin') {
    return scope;
  }

  if (filter.actor.mode === 'teacher') {
    const teacherId = filter.actor.teacherId;
    return {
      ...scope,
      OR: [
        {
          courseId: { not: null },
          course: {
            groups: {
              some: { teacherId, isActive: true },
            },
          },
        },
        {
          classSessionId: { not: null },
          classSession: {
            group: { teacherId },
          },
        },
      ],
    };
  }

  // Student: READY only + entitlement.
  const studentId = filter.actor.studentId;
  return {
    ...scope,
    uploadStatus: 'READY',
    OR: [
      {
        courseId: { not: null },
        course: {
          groups: {
            some: {
              isActive: true,
              enrollments: {
                some: { studentId, isActive: true },
              },
            },
          },
        },
      },
      {
        classSessionId: { not: null },
        classSession: {
          isActive: true,
          group: {
            isActive: true,
            enrollments: {
              some: { studentId, isActive: true },
            },
          },
        },
      },
    ],
  };
}

export function createMaterialStore(database: DbClient): MaterialStore {
  return {
    async findById(id) {
      const row = await database.material.findUnique({ where: { id } });
      return row ? mapRow(row) : null;
    },

    async list(filter) {
      const rows = await database.material.findMany({
        where: listWhere(filter),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async create(input) {
      const row = await database.material.create({
        data: {
          title: input.title,
          description: input.description,
          kind: input.kind,
          uploadStatus: input.uploadStatus,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          originalFilename: input.originalFilename,
          externalUrl: input.externalUrl,
          courseId: input.courseId,
          classSessionId: input.classSessionId,
          createdByUserId: input.createdByUserId,
        },
      });
      return mapRow(row);
    },

    async updateMetadata(id, patch) {
      try {
        const row = await database.material.update({
          where: { id },
          data: {
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.description !== undefined
              ? { description: patch.description }
              : {}),
          },
        });
        return mapRow(row);
      } catch {
        return null;
      }
    },

    async markReady(id, sizeBytes) {
      try {
        const row = await database.material.update({
          where: { id },
          data: { uploadStatus: 'READY', sizeBytes },
        });
        return mapRow(row);
      } catch {
        return null;
      }
    },

    async softDelete(id) {
      try {
        const row = await database.material.update({
          where: { id },
          data: { isActive: false },
        });
        return mapRow(row);
      } catch {
        return null;
      }
    },

    async resolveAssociation(input) {
      if (input.courseId) {
        const course = await database.course.findUnique({
          where: { id: input.courseId },
        });
        if (!course) return null;
        return {
          courseId: course.id,
          classSessionId: null,
          sessionGroupId: null,
          sessionIsActive: true,
          sessionGroupIsActive: true,
          sessionTeacherId: null,
          courseIsActive: course.isActive,
        };
      }
      if (input.classSessionId) {
        const session = await database.classSession.findUnique({
          where: { id: input.classSessionId },
          include: { group: true },
        });
        if (!session) return null;
        return {
          courseId: null,
          classSessionId: session.id,
          sessionGroupId: session.groupId,
          sessionIsActive: session.isActive,
          sessionGroupIsActive: session.group.isActive,
          sessionTeacherId: session.group.teacherId,
          courseIsActive: true,
        };
      }
      return null;
    },

    async teacherOwnsCourse(teacherId, courseId) {
      const count = await database.group.count({
        where: {
          courseId,
          teacherId,
          isActive: true,
        },
      });
      return count > 0;
    },

    async teacherOwnsClassSession(teacherId, classSessionId) {
      const session = await database.classSession.findUnique({
        where: { id: classSessionId },
        include: { group: true },
      });
      return session?.group.teacherId === teacherId;
    },

    async studentEntitledToCourse(studentId, courseId) {
      const count = await database.enrollment.count({
        where: {
          studentId,
          isActive: true,
          group: {
            courseId,
            isActive: true,
          },
        },
      });
      return count > 0;
    },

    async studentEntitledToClassSession(studentId, classSessionId) {
      const session = await database.classSession.findUnique({
        where: { id: classSessionId },
        include: { group: true },
      });
      if (!session || !session.isActive || !session.group.isActive) {
        return false;
      }
      const enrollment = await database.enrollment.findUnique({
        where: {
          groupId_studentId: {
            groupId: session.groupId,
            studentId,
          },
        },
      });
      return enrollment?.isActive === true;
    },
  };
}
