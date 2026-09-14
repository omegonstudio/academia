import type {
  Course,
  CourseServiceType,
  CourseType,
  CreateCourseRequest,
  UpdateCourseRequest,
} from '@academia/shared';
import { durationMinutesForServiceType } from '@academia/shared';

export class CourseNotFoundError extends Error {
  constructor(message = 'Course not found.') {
    super(message);
    this.name = 'CourseNotFoundError';
  }
}

export interface CourseRecord {
  id: string;
  name: string;
  description: string | null;
  courseType: CourseType;
  serviceType: CourseServiceType;
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
    isActive: boolean;
  }): Promise<CourseRecord>;
  update(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      courseType?: CourseType;
      serviceType?: CourseServiceType;
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
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
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
  const record = await store.create({
    name: input.name,
    description: input.description ?? null,
    courseType: input.courseType,
    serviceType: input.serviceType,
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
  const record = await store.update(id, {
    name: input.name,
    description: input.description,
    courseType: input.courseType,
    serviceType: input.serviceType,
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
