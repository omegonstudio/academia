import type { CourseServiceType, CourseType, FinanceCurrency } from '@academia/shared';
import { isCourseServiceType, isCourseType, isFinanceCurrency } from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import type { CourseRecord, CourseStore } from './course-service.js';

function mapRow(row: {
  id: string;
  name: string;
  description: string | null;
  courseType: string;
  serviceType: string;
  amountMinor: bigint | null;
  currency: string | null;
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
  let currency: FinanceCurrency | null = null;
  if (row.currency !== null) {
    if (!isFinanceCurrency(row.currency)) {
      throw new Error(`Invalid course currency in database: ${row.currency}`);
    }
    currency = row.currency;
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    courseType: row.courseType,
    serviceType: row.serviceType,
    amountMinor: row.amountMinor,
    currency,
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
          amountMinor: input.amountMinor,
          currency: input.currency,
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
        amountMinor?: bigint | null;
        currency?: FinanceCurrency | null;
        isActive?: boolean;
      } = {};
      if (patch.name !== undefined) data.name = patch.name;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.courseType !== undefined) data.courseType = patch.courseType;
      if (patch.serviceType !== undefined) data.serviceType = patch.serviceType;
      if (patch.amountMinor !== undefined) data.amountMinor = patch.amountMinor;
      if (patch.currency !== undefined) data.currency = patch.currency;
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
