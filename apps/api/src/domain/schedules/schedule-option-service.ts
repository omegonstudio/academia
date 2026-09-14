import type {
  CreateScheduleOptionRequest,
  ScheduleOption,
  UpdateScheduleOptionRequest,
  Weekday,
} from '@academia/shared';
import {
  formatScheduleLabel,
  parseTimeToMinutes,
  weekdaySchema,
  timeOfDaySchema,
} from '@academia/shared';

export class ScheduleOptionNotFoundError extends Error {
  constructor(message = 'Schedule option not found.') {
    super(message);
    this.name = 'ScheduleOptionNotFoundError';
  }
}

export class ScheduleOptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleOptionValidationError';
  }
}

export interface ScheduleOptionRecord {
  id: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleOptionStore {
  list(): Promise<ScheduleOptionRecord[]>;
  findById(id: string): Promise<ScheduleOptionRecord | null>;
  create(input: {
    day: Weekday;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }): Promise<ScheduleOptionRecord>;
  update(
    id: string,
    patch: {
      day?: Weekday;
      startTime?: string;
      endTime?: string;
      isActive?: boolean;
    },
  ): Promise<ScheduleOptionRecord>;
  softDelete(id: string): Promise<ScheduleOptionRecord>;
}

export function toScheduleOptionDto(
  record: ScheduleOptionRecord,
): ScheduleOption {
  return {
    id: record.id,
    day: record.day,
    startTime: record.startTime,
    endTime: record.endTime,
    label: formatScheduleLabel(record.day, record.startTime, record.endTime),
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function assertTimeOrder(startTime: string, endTime: string): void {
  const start = timeOfDaySchema.safeParse(startTime);
  const end = timeOfDaySchema.safeParse(endTime);
  if (!start.success || !end.success) {
    throw new ScheduleOptionValidationError('Invalid time (expected HH:mm).');
  }
  if (parseTimeToMinutes(start.data) >= parseTimeToMinutes(end.data)) {
    throw new ScheduleOptionValidationError(
      'startTime must be before endTime.',
    );
  }
}

export async function listScheduleOptions(
  store: ScheduleOptionStore,
): Promise<ScheduleOption[]> {
  return (await store.list()).map(toScheduleOptionDto);
}

export async function getScheduleOption(
  store: ScheduleOptionStore,
  id: string,
): Promise<ScheduleOption> {
  const row = await store.findById(id);
  if (!row) throw new ScheduleOptionNotFoundError();
  return toScheduleOptionDto(row);
}

export async function createScheduleOption(
  store: ScheduleOptionStore,
  input: CreateScheduleOptionRequest,
): Promise<ScheduleOption> {
  assertTimeOrder(input.startTime, input.endTime);
  const record = await store.create({
    day: input.day,
    startTime: input.startTime,
    endTime: input.endTime,
    isActive: input.isActive ?? true,
  });
  return toScheduleOptionDto(record);
}

export async function updateScheduleOption(
  store: ScheduleOptionStore,
  id: string,
  input: UpdateScheduleOptionRequest,
): Promise<ScheduleOption> {
  const existing = await store.findById(id);
  if (!existing) throw new ScheduleOptionNotFoundError();

  const day = input.day ?? existing.day;
  const startTime = input.startTime ?? existing.startTime;
  const endTime = input.endTime ?? existing.endTime;

  if (!weekdaySchema.safeParse(day).success) {
    throw new ScheduleOptionValidationError('Invalid weekday.');
  }
  assertTimeOrder(startTime, endTime);

  const record = await store.update(id, {
    day,
    startTime,
    endTime,
    isActive: input.isActive,
  });
  return toScheduleOptionDto(record);
}

export async function deleteScheduleOption(
  store: ScheduleOptionStore,
  id: string,
): Promise<ScheduleOption> {
  const existing = await store.findById(id);
  if (!existing) throw new ScheduleOptionNotFoundError();
  return toScheduleOptionDto(await store.softDelete(id));
}
