import type { AssignTeacherRequest, Role, TeacherAssignment } from '@academia/shared';

export class AssignmentNotFoundError extends Error {
  constructor(message = 'Assignment not found.') {
    super(message);
    this.name = 'AssignmentNotFoundError';
  }
}

export class AssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssignmentValidationError';
  }
}

export interface AssignmentParticipant {
  id: string;
  userId: string;
  isActive: boolean;
}

/** Authenticated caller; identity must come from the session, never the body. */
export interface AssignmentActor {
  id: string;
  role: Role;
}

export interface AssignmentRecord {
  studentId: string;
  teacherId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherAssignmentStore {
  findByStudentId(studentId: string): Promise<AssignmentRecord | null>;
  findStudent(id: string): Promise<AssignmentParticipant | null>;
  findTeacher(id: string): Promise<AssignmentParticipant | null>;
  /** Replaces any existing assignment for the student. */
  upsert(studentId: string, teacherId: string): Promise<AssignmentRecord>;
  deleteByStudentId(studentId: string): Promise<boolean>;
}

export function toAssignmentDto(record: AssignmentRecord): TeacherAssignment {
  return {
    studentId: record.studentId,
    teacherId: record.teacherId,
    assignedAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getStudentTeacherAssignment(
  store: TeacherAssignmentStore,
  studentId: string,
): Promise<TeacherAssignment> {
  const student = await store.findStudent(studentId);
  if (!student) {
    throw new AssignmentValidationError('Student not found.');
  }

  const row = await store.findByStudentId(studentId);
  if (!row) throw new AssignmentNotFoundError();
  return toAssignmentDto(row);
}

export async function assignTeacherToStudent(
  store: TeacherAssignmentStore,
  studentId: string,
  input: AssignTeacherRequest,
  actor: AssignmentActor,
): Promise<TeacherAssignment> {
  const student = await store.findStudent(studentId);
  if (!student) {
    throw new AssignmentValidationError('Student not found.');
  }
  if (!student.isActive) {
    throw new AssignmentValidationError('Student is inactive.');
  }

  const teacher = await store.findTeacher(input.teacherId);
  if (!teacher) {
    throw new AssignmentValidationError('Teacher not found.');
  }
  if (!teacher.isActive) {
    throw new AssignmentValidationError('Teacher is inactive.');
  }

  // Actor-based rule: a TEACHER session cannot assign a student to themselves.
  if (actor.role === 'TEACHER' && teacher.userId === actor.id) {
    throw new AssignmentValidationError(
      'Teachers cannot assign students to themselves.',
    );
  }

  // Profile integrity: Student and Teacher profiles must not share the same User.
  if (student.userId === teacher.userId) {
    throw new AssignmentValidationError(
      'A student cannot be assigned to themselves.',
    );
  }

  const record = await store.upsert(studentId, input.teacherId);
  return toAssignmentDto(record);
}

export async function unassignTeacherFromStudent(
  store: TeacherAssignmentStore,
  studentId: string,
): Promise<void> {
  const student = await store.findStudent(studentId);
  if (!student) {
    throw new AssignmentValidationError('Student not found.');
  }

  const removed = await store.deleteByStudentId(studentId);
  if (!removed) throw new AssignmentNotFoundError();
}
