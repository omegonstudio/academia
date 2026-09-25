import {
  GROUP_MAX_ACTIVE_ENROLLMENTS,
  type EnrollStudentRequest,
  type Enrollment,
} from '@academia/shared';

export class EnrollmentNotFoundError extends Error {
  constructor(message = 'Enrollment not found.') {
    super(message);
    this.name = 'EnrollmentNotFoundError';
  }
}

export class EnrollmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnrollmentValidationError';
  }
}

export interface EnrollmentRecord {
  id: string;
  groupId: string;
  studentId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrollmentGroupRef {
  id: string;
  isActive: boolean;
}

export interface EnrollmentStudentRef {
  id: string;
  isActive: boolean;
}

export interface EnrollmentStore {
  findGroup(groupId: string): Promise<EnrollmentGroupRef | null>;
  findStudent(studentId: string): Promise<EnrollmentStudentRef | null>;
  listActiveByGroup(groupId: string): Promise<EnrollmentRecord[]>;
  findByGroupAndStudent(
    groupId: string,
    studentId: string,
  ): Promise<EnrollmentRecord | null>;
  /**
   * Locks the group, enforces capacity, creates or reactivates membership.
   * Implementations must serialize concurrent enrolls for the same group.
   */
  enrollActive(
    groupId: string,
    studentId: string,
    maxActive: number,
  ): Promise<EnrollmentRecord>;
  softUnenroll(
    groupId: string,
    studentId: string,
  ): Promise<EnrollmentRecord | null>;
}

export function toEnrollmentDto(record: EnrollmentRecord): Enrollment {
  return {
    id: record.id,
    groupId: record.groupId,
    studentId: record.studentId,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listGroupEnrollments(
  store: EnrollmentStore,
  groupId: string,
): Promise<Enrollment[]> {
  const group = await store.findGroup(groupId);
  if (!group) {
    throw new EnrollmentNotFoundError('Group not found.');
  }

  return (await store.listActiveByGroup(groupId)).map(toEnrollmentDto);
}

export async function enrollStudentInGroup(
  store: EnrollmentStore,
  groupId: string,
  input: EnrollStudentRequest,
): Promise<Enrollment> {
  const group = await store.findGroup(groupId);
  if (!group) {
    throw new EnrollmentNotFoundError('Group not found.');
  }
  if (!group.isActive) {
    throw new EnrollmentValidationError('Group is inactive.');
  }

  const student = await store.findStudent(input.studentId);
  if (!student) {
    throw new EnrollmentValidationError('Student not found.');
  }
  if (!student.isActive) {
    throw new EnrollmentValidationError('Student is inactive.');
  }

  const existing = await store.findByGroupAndStudent(groupId, input.studentId);
  if (existing?.isActive) {
    throw new EnrollmentValidationError(
      'Student is already enrolled in this group.',
    );
  }

  const record = await store.enrollActive(
    groupId,
    input.studentId,
    GROUP_MAX_ACTIVE_ENROLLMENTS,
  );
  return toEnrollmentDto(record);
}

export async function unenrollStudentFromGroup(
  store: EnrollmentStore,
  groupId: string,
  studentId: string,
): Promise<void> {
  const group = await store.findGroup(groupId);
  if (!group) {
    throw new EnrollmentNotFoundError('Group not found.');
  }

  const removed = await store.softUnenroll(groupId, studentId);
  if (!removed) {
    throw new EnrollmentNotFoundError('Enrollment not found.');
  }
}

export { GROUP_MAX_ACTIVE_ENROLLMENTS };
