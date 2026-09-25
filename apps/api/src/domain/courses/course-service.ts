import type {
  Course,
  CourseServiceType,
  CourseType,
  CreateCourseRequest,
  FinanceCurrency,
  UpdateCourseRequest,
} from '@academia/shared';
import {
  durationMinutesForServiceType,
  moneyMinorToString,
  parseMoneyMinor,
} from '@academia/shared';

export class CourseNotFoundError extends Error {
  constructor(message = 'Course not found.') {
    super(message);
    this.name = 'CourseNotFoundError';
  }
}

export class CourseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseValidationError';
  }
}

export interface CourseRecord {
  id: string;
  name: string;
  description: string | null;
  courseType: CourseType;
  serviceType: CourseServiceType;
  amountMinor: bigint | null;
  currency: FinanceCurrency | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseStore {
  list(): Promise<CourseRecord[]>;
  findById(id: string): Promise<CourseRecord | null>;
  create(input: {
    name: string;
    description: string | null;
    courseType: CourseType;
    serviceType: CourseServiceType;
    amountMinor: bigint | null;
    currency: FinanceCurrency | null;
    isActive: boolean;
  }): Promise<CourseRecord>;
  update(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      courseType?: CourseType;
      serviceType?: CourseServiceType;
      amountMinor?: bigint | null;
      currency?: FinanceCurrency | null;
      isActive?: boolean;
    },
  ): Promise<CourseRecord>;
  softDelete(id: string): Promise<CourseRecord>;
}

export function toCourseDto(record: CourseRecord): Course {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    courseType: record.courseType,
    serviceType: record.serviceType,
    durationMinutes: durationMinutesForServiceType(record.serviceType),
    amountMinor:
      record.amountMinor === null ? null : moneyMinorToString(record.amountMinor),
    currency: record.currency,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function parseOptionalPrice(
  amountMinor: string | undefined,
  currency: FinanceCurrency | undefined,
): { amountMinor: bigint | null; currency: FinanceCurrency | null } {
  if (amountMinor === undefined && currency === undefined) {
    return { amountMinor: null, currency: null };
  }
  if (amountMinor === undefined || currency === undefined) {
    throw new CourseValidationError(
      'amountMinor and currency must be provided together.',
    );
  }
  const parsed = parseMoneyMinor(amountMinor);
  if (parsed < 0n) {
    throw new CourseValidationError('amountMinor must be non-negative.');
  }
  return { amountMinor: parsed, currency };
}

export async function listCourses(store: CourseStore): Promise<Course[]> {
  return (await store.list()).map(toCourseDto);
}

export async function getCourse(
  store: CourseStore,
  id: string,
): Promise<Course> {
  const row = await store.findById(id);
  if (!row) throw new CourseNotFoundError();
  return toCourseDto(row);
}

export async function createCourse(
  store: CourseStore,
  input: CreateCourseRequest,
): Promise<Course> {
  const price = parseOptionalPrice(input.amountMinor, input.currency);
  const record = await store.create({
    name: input.name,
    description: input.description ?? null,
    courseType: input.courseType,
    serviceType: input.serviceType,
    amountMinor: price.amountMinor,
    currency: price.currency,
    isActive: input.isActive ?? true,
  });
  return toCourseDto(record);
}

export async function updateCourse(
  store: CourseStore,
  id: string,
  input: UpdateCourseRequest,
): Promise<Course> {
  const existing = await store.findById(id);
  if (!existing) throw new CourseNotFoundError();

  let amountMinor: bigint | null | undefined;
  let currency: FinanceCurrency | null | undefined;
  if (input.amountMinor !== undefined || input.currency !== undefined) {
    if (input.amountMinor === null || input.currency === null) {
      amountMinor = null;
      currency = null;
    } else if (
      typeof input.amountMinor === 'string' &&
      input.currency !== undefined &&
      input.currency !== null
    ) {
      const parsed = parseMoneyMinor(input.amountMinor);
      if (parsed < 0n) {
        throw new CourseValidationError('amountMinor must be non-negative.');
      }
      amountMinor = parsed;
      currency = input.currency;
    } else {
      throw new CourseValidationError(
        'amountMinor and currency must be cleared or set together.',
      );
    }
  }

  const record = await store.update(id, {
    name: input.name,
    description: input.description,
    courseType: input.courseType,
    serviceType: input.serviceType,
    amountMinor,
    currency,
    isActive: input.isActive,
  });
  return toCourseDto(record);
}

export async function deleteCourse(
  store: CourseStore,
  id: string,
): Promise<Course> {
  const existing = await store.findById(id);
  if (!existing) throw new CourseNotFoundError();
  return toCourseDto(await store.softDelete(id));
}
