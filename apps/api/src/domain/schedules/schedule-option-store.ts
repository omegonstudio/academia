import type { Weekday } from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import type {
  ScheduleOptionRecord,
  ScheduleOptionStore,
} from './schedule-option-service.js';

function mapRow(row: {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ScheduleOptionRecord {
  return {
    id: row.id,
    day: row.day as Weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createScheduleOptionStore(
  database: Database,
): ScheduleOptionStore {
  return {
    async list() {
      const rows = await database.scheduleOption.findMany({
        orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
      });
      return rows.map(mapRow);
    },

    async findById(id) {
      const row = await database.scheduleOption.findUnique({ where: { id } });
      return row ? mapRow(row) : null;
    },

    async create(input) {
      const row = await database.scheduleOption.create({
        data: {
          day: input.day,
          startTime: input.startTime,
          endTime: input.endTime,
          isActive: input.isActive,
        },
      });
      return mapRow(row);
    },

    async update(id, patch) {
      const data: {
        day?: string;
        startTime?: string;
        endTime?: string;
        isActive?: boolean;
      } = {};
      if (patch.day !== undefined) data.day = patch.day;
      if (patch.startTime !== undefined) data.startTime = patch.startTime;
      if (patch.endTime !== undefined) data.endTime = patch.endTime;
      if (patch.isActive !== undefined) data.isActive = patch.isActive;

      const row = await database.scheduleOption.update({ where: { id }, data });
      return mapRow(row);
    },

    async softDelete(id) {
      const row = await database.scheduleOption.update({
        where: { id },
        data: { isActive: false },
      });
      return mapRow(row);
    },
  };
}
