import type { CourseServiceType, CourseType } from '@academia/shared';
import { isCourseServiceType, isCourseType } from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import type { CourseRecord, CourseStore } from './course-service.js';

function mapRow(row: {
  id: string;
  name: string;
  description: string | null;
  courseType: string;
  serviceType: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CourseRecord {
  if (!isCourseType(row.courseType)) {
    throw new Error(`Invalid course courseType in database: ${row.courseType}`);
  }
  if (!isCourseServiceType(row.serviceType)) {
    throw new Error(`Invalid course serviceType in database: ${row.serviceType}`);
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    courseType: row.courseType,
    serviceType: row.serviceType,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createCourseStore(database: Database): CourseStore {
  return {
    async list() {
      const rows = await database.course.findMany({
        orderBy: [{ name: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async findById(id) {
      const row = await database.course.findUnique({ where: { id } });
      return row ? mapRow(row) : null;
    },

    async create(input) {
      const row = await database.course.create({
        data: {
          name: input.name,
          description: input.description,
          courseType: input.courseType,
          serviceType: input.serviceType,
          isActive: input.isActive,
        },
      });
      return mapRow(row);
    },

    async update(id, patch) {
      const data: {
        name?: string;
        description?: string | null;
        courseType?: CourseType;
        serviceType?: CourseServiceType;
        isActive?: boolean;
      } = {};
      if (patch.name !== undefined) data.name = patch.name;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.courseType !== undefined) data.courseType = patch.courseType;
      if (patch.serviceType !== undefined) data.serviceType = patch.serviceType;
      if (patch.isActive !== undefined) data.isActive = patch.isActive;

      const row = await database.course.update({ where: { id }, data });
      return mapRow(row);
    },

    async softDelete(id) {
      const row = await database.course.update({
        where: { id },
        data: { isActive: false },
      });
      return mapRow(row);
    },
  };
}
