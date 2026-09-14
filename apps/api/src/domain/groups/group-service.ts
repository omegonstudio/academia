import type {
  AssignGroupTeacherRequest,
  CreateGroupRequest,
  Group,
  UpdateGroupRequest,
} from '@academia/shared';

export class GroupNotFoundError extends Error {
  constructor(message = 'Group not found.') {
    super(message);
    this.name = 'GroupNotFoundError';
  }
}

export class GroupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupValidationError';
  }
}

export interface GroupRecord {
  id: string;
  courseId: string;
  name: string;
  teacherId: string | null;
  scheduleOptionId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupCourseRef {
  id: string;
  isActive: boolean;
}

export interface GroupTeacherRef {
  id: string;
  isActive: boolean;
}

export interface GroupScheduleRef {
  id: string;
  isActive: boolean;
}

export interface GroupStore {
  list(): Promise<GroupRecord[]>;
  findById(id: string): Promise<GroupRecord | null>;
  findCourse(courseId: string): Promise<GroupCourseRef | null>;
  findTeacher(teacherId: string): Promise<GroupTeacherRef | null>;
  findScheduleOption(
    scheduleOptionId: string,
  ): Promise<GroupScheduleRef | null>;
  create(input: {
    courseId: string;
    name: string;
    isActive: boolean;
  }): Promise<GroupRecord>;
  update(
    id: string,
    patch: {
      name?: string;
      isActive?: boolean;
      teacherId?: string | null;
      scheduleOptionId?: string | null;
    },
  ): Promise<GroupRecord>;
  softDelete(id: string): Promise<GroupRecord>;
}

export function toGroupDto(record: GroupRecord): Group {
  return {
    id: record.id,
    courseId: record.courseId,
    name: record.name,
    teacherId: record.teacherId,
    scheduleOptionId: record.scheduleOptionId,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listGroups(store: GroupStore): Promise<Group[]> {
  return (await store.list()).map(toGroupDto);
}

export async function getGroup(store: GroupStore, id: string): Promise<Group> {
  const row = await store.findById(id);
  if (!row) throw new GroupNotFoundError();
  return toGroupDto(row);
}

export async function createGroup(
  store: GroupStore,
  input: CreateGroupRequest,
): Promise<Group> {
  const course = await store.findCourse(input.courseId);
  if (!course) {
    throw new GroupValidationError('Course not found.');
  }
  if (!course.isActive) {
    throw new GroupValidationError('Course is inactive.');
  }

  const record = await store.create({
    courseId: input.courseId,
    name: input.name,
    isActive: input.isActive ?? true,
  });
  return toGroupDto(record);
}

export async function updateGroup(
  store: GroupStore,
  id: string,
  input: UpdateGroupRequest,
): Promise<Group> {
  const existing = await store.findById(id);
  if (!existing) throw new GroupNotFoundError();

  if (input.scheduleOptionId !== undefined && input.scheduleOptionId !== null) {
    const option = await store.findScheduleOption(input.scheduleOptionId);
    if (!option) {
      throw new GroupValidationError('Schedule option not found.');
    }
    if (!option.isActive) {
      throw new GroupValidationError('Schedule option is inactive.');
    }
  }

  const record = await store.update(id, {
    name: input.name,
    isActive: input.isActive,
    scheduleOptionId: input.scheduleOptionId,
  });
  return toGroupDto(record);
}

export async function deleteGroup(
  store: GroupStore,
  id: string,
): Promise<Group> {
  const existing = await store.findById(id);
  if (!existing) throw new GroupNotFoundError();
  return toGroupDto(await store.softDelete(id));
}

export async function getGroupTeacher(
  store: GroupStore,
  groupId: string,
): Promise<{ groupId: string; teacherId: string }> {
  const group = await store.findById(groupId);
  if (!group) throw new GroupNotFoundError();
  if (!group.teacherId) {
    throw new GroupNotFoundError('Group has no teacher assigned.');
  }
  return { groupId: group.id, teacherId: group.teacherId };
}

export async function assignGroupTeacher(
  store: GroupStore,
  groupId: string,
  input: AssignGroupTeacherRequest,
): Promise<{ groupId: string; teacherId: string }> {
  const group = await store.findById(groupId);
  if (!group) throw new GroupNotFoundError();

  const teacher = await store.findTeacher(input.teacherId);
  if (!teacher) {
    throw new GroupValidationError('Teacher not found.');
  }
  if (!teacher.isActive) {
    throw new GroupValidationError('Teacher is inactive.');
  }

  const updated = await store.update(groupId, { teacherId: input.teacherId });
  return { groupId: updated.id, teacherId: updated.teacherId! };
}

export async function unassignGroupTeacher(
  store: GroupStore,
  groupId: string,
): Promise<void> {
  const group = await store.findById(groupId);
  if (!group) throw new GroupNotFoundError();
  if (!group.teacherId) {
    throw new GroupNotFoundError('Group has no teacher assigned.');
  }
  await store.update(groupId, { teacherId: null });
}
