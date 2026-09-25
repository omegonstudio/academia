import type { Database } from '../../lib/prisma.js';
import type { GroupRecord, GroupStore } from './group-service.js';

function mapRow(row: {
  id: string;
  courseId: string;
  name: string;
  teacherId: string | null;
  scheduleOptionId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): GroupRecord {
  return {
    id: row.id,
    courseId: row.courseId,
    name: row.name,
    teacherId: row.teacherId,
    scheduleOptionId: row.scheduleOptionId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createGroupStore(database: Database): GroupStore {
  return {
    async list() {
      const rows = await database.group.findMany({
        orderBy: [{ name: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async findById(id) {
      const row = await database.group.findUnique({ where: { id } });
      return row ? mapRow(row) : null;
    },

    async findCourse(courseId) {
      const row = await database.course.findUnique({
        where: { id: courseId },
        select: { id: true, isActive: true },
      });
      return row;
    },

    async findTeacher(teacherId) {
      const row = await database.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true, isActive: true },
      });
      return row;
    },

    async findScheduleOption(scheduleOptionId) {
      const row = await database.scheduleOption.findUnique({
        where: { id: scheduleOptionId },
        select: { id: true, isActive: true },
      });
      return row;
    },

    async create(input) {
      const row = await database.group.create({
        data: {
          courseId: input.courseId,
          name: input.name,
          isActive: input.isActive,
        },
      });
      return mapRow(row);
    },

    async update(id, patch) {
      const data: {
        name?: string;
        isActive?: boolean;
        teacherId?: string | null;
        scheduleOptionId?: string | null;
      } = {};
      if (patch.name !== undefined) data.name = patch.name;
      if (patch.isActive !== undefined) data.isActive = patch.isActive;
      if (patch.teacherId !== undefined) data.teacherId = patch.teacherId;
      if (patch.scheduleOptionId !== undefined) {
        data.scheduleOptionId = patch.scheduleOptionId;
      }

      const row = await database.group.update({ where: { id }, data });
      return mapRow(row);
    },

    async softDelete(id) {
      const row = await database.group.update({
        where: { id },
        data: { isActive: false },
      });
      return mapRow(row);
    },
  };
}
