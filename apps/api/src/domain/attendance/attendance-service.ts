import {
  isAttendanceStatus,
  type Attendance,
  type AttendanceStatus,
  type CreateAttendanceRequest,
  type UpdateAttendanceRequest,
} from '@academia/shared';

export class AttendanceNotFoundError extends Error {
  constructor(message = 'Attendance not found.') {
    super(message);
    this.name = 'AttendanceNotFoundError';
  }
}

export class AttendanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttendanceValidationError';
  }
}

export class AttendanceForbiddenError extends Error {
  constructor(message = 'You are not allowed to modify attendance for this class.') {
    super(message);
    this.name = 'AttendanceForbiddenError';
  }
}

export class AttendanceAlreadyExistsError extends Error {
  constructor(
    message = 'Attendance already exists for this student and class session.',
  ) {
    super(message);
    this.name = 'AttendanceAlreadyExistsError';
  }
}

export interface AttendanceStudentRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface AttendanceRecord {
  id: string;
  classSessionId: string;
  studentId: string;
  status: AttendanceStatus;
  student: AttendanceStudentRef;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceClassSessionRef {
  id: string;
  groupId: string;
  isActive: boolean;
  teacherId: string | null;
}

export interface AttendanceStudentLookup {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

/**
 * Write actor for attendance mutations.
 * - `admin`: classes.update (incl. SUPER_ADMIN/DIRECTOR bypass).
 * - `teacher`: Group.teacherId must match (no client-supplied teacherId).
 */
export type AttendanceWriteActor =
  | { mode: 'admin' }
  | { mode: 'teacher'; teacherId: string };

export interface AttendanceListFilter {
  /** When set (STUDENT self-scope), only that student's row is returned. */
  studentId?: string;
}

export interface AttendanceStore {
  findClassSession(
    classSessionId: string,
  ): Promise<AttendanceClassSessionRef | null>;
  findStudent(studentId: string): Promise<AttendanceStudentLookup | null>;
  hasActiveEnrollment(groupId: string, studentId: string): Promise<boolean>;
  listByClassSession(
    classSessionId: string,
    filter?: AttendanceListFilter,
  ): Promise<AttendanceRecord[]>;
  findByClassSessionAndStudent(
    classSessionId: string,
    studentId: string,
  ): Promise<AttendanceRecord | null>;
  create(input: {
    classSessionId: string;
    studentId: string;
    status: AttendanceStatus;
  }): Promise<AttendanceRecord>;
  updateStatus(
    classSessionId: string,
    studentId: string,
    status: AttendanceStatus,
  ): Promise<AttendanceRecord | null>;
}

export function toAttendanceDto(record: AttendanceRecord): Attendance {
  return {
    id: record.id,
    classSessionId: record.classSessionId,
    studentId: record.studentId,
    status: record.status,
    student: {
      id: record.student.id,
      firstName: record.student.firstName,
      lastName: record.student.lastName,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function assertWriteActorOwnsSession(
  actor: AttendanceWriteActor,
  session: AttendanceClassSessionRef,
): void {
  if (actor.mode === 'admin') return;
  if (session.teacherId !== actor.teacherId) {
    throw new AttendanceForbiddenError();
  }
}

async function requireWritableSession(
  store: AttendanceStore,
  classSessionId: string,
  actor: AttendanceWriteActor,
): Promise<AttendanceClassSessionRef> {
  const session = await store.findClassSession(classSessionId);
  if (!session) {
    throw new AttendanceNotFoundError('Class session not found.');
  }
  if (!session.isActive) {
    throw new AttendanceValidationError('Class session is inactive.');
  }
  assertWriteActorOwnsSession(actor, session);
  return session;
}

export async function listAttendanceForClassSession(
  store: AttendanceStore,
  classSessionId: string,
  filter?: AttendanceListFilter,
): Promise<Attendance[]> {
  const session = await store.findClassSession(classSessionId);
  if (!session) {
    throw new AttendanceNotFoundError('Class session not found.');
  }

  return (await store.listByClassSession(classSessionId, filter)).map(
    toAttendanceDto,
  );
}

export async function createAttendance(
  store: AttendanceStore,
  classSessionId: string,
  input: CreateAttendanceRequest,
  actor: AttendanceWriteActor,
): Promise<Attendance> {
  const session = await requireWritableSession(store, classSessionId, actor);

  if (!isAttendanceStatus(input.status)) {
    throw new AttendanceValidationError('Invalid attendance status.');
  }

  const student = await store.findStudent(input.studentId);
  if (!student) {
    throw new AttendanceNotFoundError('Student not found.');
  }
  if (!student.isActive) {
    throw new AttendanceValidationError('Student is inactive.');
  }

  const enrolled = await store.hasActiveEnrollment(
    session.groupId,
    input.studentId,
  );
  if (!enrolled) {
    throw new AttendanceValidationError(
      'Student is not actively enrolled in this class group.',
    );
  }

  const existing = await store.findByClassSessionAndStudent(
    classSessionId,
    input.studentId,
  );
  if (existing) {
    throw new AttendanceAlreadyExistsError();
  }

  try {
    const created = await store.create({
      classSessionId,
      studentId: input.studentId,
      status: input.status,
    });
    return toAttendanceDto(created);
  } catch (error) {
    if (error instanceof AttendanceAlreadyExistsError) {
      throw error;
    }
    throw error;
  }
}

export async function updateAttendance(
  store: AttendanceStore,
  classSessionId: string,
  studentId: string,
  input: UpdateAttendanceRequest,
  actor: AttendanceWriteActor,
): Promise<Attendance> {
  await requireWritableSession(store, classSessionId, actor);

  if (!isAttendanceStatus(input.status)) {
    throw new AttendanceValidationError('Invalid attendance status.');
  }

  const student = await store.findStudent(studentId);
  if (!student) {
    throw new AttendanceNotFoundError('Student not found.');
  }
  if (!student.isActive) {
    throw new AttendanceValidationError('Student is inactive.');
  }

  const session = await store.findClassSession(classSessionId);
  if (!session) {
    throw new AttendanceNotFoundError('Class session not found.');
  }

  const enrolled = await store.hasActiveEnrollment(session.groupId, studentId);
  if (!enrolled) {
    throw new AttendanceValidationError(
      'Student is not actively enrolled in this class group.',
    );
  }

  const updated = await store.updateStatus(
    classSessionId,
    studentId,
    input.status,
  );
  if (!updated) {
    throw new AttendanceNotFoundError('Attendance not found.');
  }
  return toAttendanceDto(updated);
}
