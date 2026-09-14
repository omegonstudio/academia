import type { CourseServiceType, CourseType, Weekday } from '@academia/shared';
import {
  isCourseServiceType,
  isCourseType,
  weekdaySchema,
} from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import type {
  ClassSessionCalendarRecord,
  ClassSessionListFilter,
  ClassSessionReadScope,
  ClassSessionRecord,
  ClassSessionStore,
} from './class-session-service.js';

type DbClient = Pick<
  Database,
  'classSession' | 'group' | 'enrollment' | '$queryRaw'
>;

function mapRow(row: {
  id: string;
  groupId: string;
  startAt: Date;
  endAt: Date;
  meetingUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ClassSessionRecord {
  return {
    id: row.id,
    groupId: row.groupId,
    startAt: row.startAt,
    endAt: row.endAt,
    meetingUrl: row.meetingUrl,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function ownershipWhere(
  scope: ClassSessionReadScope | undefined,
): Record<string, unknown> {
  if (!scope || scope.mode === 'all') return {};
  if (scope.mode === 'teacher') {
    return { group: { teacherId: scope.teacherId } };
  }
  return {
    group: {
      enrollments: {
        some: { studentId: scope.studentId, isActive: true },
      },
    },
  };
}

function createOps(database: DbClient): Omit<
  ClassSessionStore,
  'withTeacherScheduleLock'
> {
  return {
    async list(filter?: ClassSessionListFilter) {
      const rows = await database.classSession.findMany({
        where: {
          ...(filter?.groupId ? { groupId: filter.groupId } : {}),
          ...ownershipWhere(filter?.scope),
        },
        orderBy: [{ startAt: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async findById(id) {
      const row = await database.classSession.findUnique({ where: { id } });
      return row ? mapRow(row) : null;
    },

    async hasActiveEnrollment(groupId, studentId) {
      const row = await database.enrollment.findFirst({
        where: { groupId, studentId, isActive: true },
        select: { id: true },
      });
      return row !== null;
    },

    async listCalendarRange(input) {
      const rows = await database.classSession.findMany({
        where: {
          isActive: true,
          startAt: {
            gte: input.rangeStart,
            lt: input.rangeEndExclusive,
          },
          ...ownershipWhere(input.scope),
        },
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        include: {
          group: {
            select: {
              id: true,
              name: true,
              course: {
                select: {
                  id: true,
                  name: true,
                  serviceType: true,
                  courseType: true,
                },
              },
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      return rows.map((row): ClassSessionCalendarRecord => {
        if (!isCourseServiceType(row.group.course.serviceType)) {
          throw new Error(
            `Invalid course serviceType in database: ${row.group.course.serviceType}`,
          );
        }
        if (!isCourseType(row.group.course.courseType)) {
          throw new Error(
            `Invalid course courseType in database: ${row.group.course.courseType}`,
          );
        }
        return {
          id: row.id,
          startAt: row.startAt,
          endAt: row.endAt,
          meetingUrl: row.meetingUrl,
          group: {
            id: row.group.id,
            name: row.group.name,
            course: {
              id: row.group.course.id,
              name: row.group.course.name,
              serviceType: row.group.course.serviceType as CourseServiceType,
              courseType: row.group.course.courseType as CourseType,
            },
          },
          teacher: row.group.teacher
            ? {
                id: row.group.teacher.id,
                firstName: row.group.teacher.firstName,
                lastName: row.group.teacher.lastName,
              }
            : null,
        };
      });
    },

    async findGroupContext(groupId) {
      const row = await database.group.findUnique({
        where: { id: groupId },
        select: {
          id: true,
          isActive: true,
          teacherId: true,
          scheduleOptionId: true,
          course: { select: { serviceType: true, isActive: true } },
          scheduleOption: {
            select: { isActive: true, day: true, startTime: true },
          },
        },
      });
      if (!row) return null;
      if (!isCourseServiceType(row.course.serviceType)) {
        throw new Error(
          `Invalid course serviceType in database: ${row.course.serviceType}`,
        );
      }

      let scheduleDay: Weekday | null = null;
      if (row.scheduleOption) {
        const parsed = weekdaySchema.safeParse(row.scheduleOption.day);
        scheduleDay = parsed.success ? parsed.data : null;
      }

      return {
        id: row.id,
        isActive: row.isActive,
        teacherId: row.teacherId,
        scheduleOptionId: row.scheduleOptionId,
        serviceType: row.course.serviceType as CourseServiceType,
        courseIsActive: row.course.isActive,
        scheduleOptionActive: row.scheduleOption
          ? row.scheduleOption.isActive
          : null,
        scheduleDay,
        scheduleStartTime: row.scheduleOption?.startTime ?? null,
      };
    },

    async findActiveOverlappingForTeacher(input) {
      const row = await database.classSession.findFirst({
        where: {
          isActive: true,
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt },
          ...(input.excludeSessionId
            ? { id: { not: input.excludeSessionId } }
            : {}),
          group: { teacherId: input.teacherId },
        },
        orderBy: [{ startAt: 'asc' }],
      });
      return row ? mapRow(row) : null;
    },

    async create(input) {
      const row = await database.classSession.create({
        data: {
          groupId: input.groupId,
          startAt: input.startAt,
          endAt: input.endAt,
          meetingUrl: input.meetingUrl,
          isActive: input.isActive,
        },
      });
      return mapRow(row);
    },

    async createManySkippingDuplicates(inputs) {
      if (inputs.length === 0) {
        return { created: [], skippedCount: 0 };
      }

      const groupId = inputs[0]!.groupId;
      const startAts = inputs.map((input) => input.startAt);

      const before = await database.classSession.findMany({
        where: { groupId, startAt: { in: startAts } },
        select: { startAt: true },
      });
      const beforeKeys = new Set(
        before.map((row) => row.startAt.toISOString()),
      );

      await database.classSession.createMany({
        data: inputs.map((input) => ({
          groupId: input.groupId,
          startAt: input.startAt,
          endAt: input.endAt,
          meetingUrl: input.meetingUrl,
          isActive: input.isActive,
        })),
        skipDuplicates: true,
      });

      const after = await database.classSession.findMany({
        where: { groupId, startAt: { in: startAts } },
        orderBy: [{ startAt: 'asc' }],
      });
      const created = after
        .filter((row) => !beforeKeys.has(row.startAt.toISOString()))
        .map(mapRow);

      return {
        created,
        skippedCount: inputs.length - created.length,
      };
    },

    async update(id, patch) {
      const data: {
        startAt?: Date;
        endAt?: Date;
        meetingUrl?: string | null;
        isActive?: boolean;
      } = {};
      if (patch.startAt !== undefined) data.startAt = patch.startAt;
      if (patch.endAt !== undefined) data.endAt = patch.endAt;
      if (patch.meetingUrl !== undefined) data.meetingUrl = patch.meetingUrl;
      if (patch.isActive !== undefined) data.isActive = patch.isActive;

      const row = await database.classSession.update({ where: { id }, data });
      return mapRow(row);
    },

    async softDelete(id) {
      const row = await database.classSession.update({
        where: { id },
        data: { isActive: false },
      });
      return mapRow(row);
    },
  };
}

export function createClassSessionStore(database: Database): ClassSessionStore {
  const store: ClassSessionStore = {
    ...createOps(database),

    async withTeacherScheduleLock(teacherId, fn) {
      if (!teacherId) {
        return fn(store);
      }

      // Lock + all reads/writes must share this transaction connection.
      // EXCLUDE(teacher_id, tstzrange) would require denormalizing teacherId
      // onto class_sessions; we deliberately keep Teacher via Group only.
      return database.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "teachers"
          WHERE id = CAST(${teacherId} AS uuid)
          FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new Error(`Teacher not found for schedule lock: ${teacherId}`);
        }
        const txOps = createOps(tx as unknown as DbClient);
        const txStore: ClassSessionStore = {
          ...txOps,
          withTeacherScheduleLock: async (_id, nested) => nested(txStore),
        };
        return fn(txStore);
      });
    },
  };

  return store;
}
