import type {
  CreateStudentRequest,
  Student,
  StudentLevel,
  UpdateStudentRequest,
} from '@academia/shared';

export class StudentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudentConflictError';
  }
}

export class StudentNotFoundError extends Error {
  constructor(message = 'Student not found.') {
    super(message);
    this.name = 'StudentNotFoundError';
  }
}

export class StudentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudentValidationError';
  }
}

export interface StudentRecord {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  level: StudentLevel;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentStore {
  list(): Promise<StudentRecord[]>;
  findById(id: string): Promise<StudentRecord | null>;
  findByUserId(userId: string): Promise<StudentRecord | null>;
  findUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    role: string;
    hasStudent: boolean;
  } | null>;
  createWithNewUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    level: StudentLevel;
    isActive: boolean;
  }): Promise<StudentRecord>;
  createForExistingUser(input: {
    userId: string;
    firstName: string;
    lastName: string;
    level: StudentLevel;
    isActive: boolean;
  }): Promise<StudentRecord>;
  update(
    id: string,
    patch: {
      firstName?: string;
      lastName?: string;
      level?: StudentLevel;
      isActive?: boolean;
    },
  ): Promise<StudentRecord>;
  /** Soft-deactivate student profile and linked User. */
  softDelete(id: string): Promise<StudentRecord>;
}

export function toStudentDto(record: StudentRecord): Student {
  return {
    id: record.id,
    userId: record.userId,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    level: record.level,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listStudents(store: StudentStore): Promise<Student[]> {
  const rows = await store.list();
  return rows.map(toStudentDto);
}

export async function getStudent(
  store: StudentStore,
  id: string,
): Promise<Student> {
  const row = await store.findById(id);
  if (!row) throw new StudentNotFoundError();
  return toStudentDto(row);
}

export async function createStudent(
  store: StudentStore,
  input: CreateStudentRequest,
  hashPassword: (plain: string) => Promise<string>,
): Promise<Student> {
  const existing = await store.findUserByEmail(input.email);

  if (existing) {
    if (existing.role !== 'STUDENT') {
      throw new StudentConflictError(
        'That email already belongs to a user with another role.',
      );
    }
    if (existing.hasStudent) {
      throw new StudentConflictError(
        'A student profile already exists for that email.',
      );
    }

    const record = await store.createForExistingUser({
      userId: existing.id,
      firstName: input.firstName,
      lastName: input.lastName,
      level: input.level,
      isActive: input.isActive ?? true,
    });
    return toStudentDto(record);
  }

  if (!input.password) {
    throw new StudentValidationError(
      'A password (min. 12 characters) is required to create a new student account.',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const record = await store.createWithNewUser({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    level: input.level,
    isActive: input.isActive ?? true,
  });
  return toStudentDto(record);
}

export async function updateStudent(
  store: StudentStore,
  id: string,
  input: UpdateStudentRequest,
): Promise<Student> {
  const existing = await store.findById(id);
  if (!existing) throw new StudentNotFoundError();

  const record = await store.update(id, {
    firstName: input.firstName,
    lastName: input.lastName,
    level: input.level,
    isActive: input.isActive,
  });
  return toStudentDto(record);
}

export async function deleteStudent(
  store: StudentStore,
  id: string,
): Promise<Student> {
  const existing = await store.findById(id);
  if (!existing) throw new StudentNotFoundError();
  const record = await store.softDelete(id);
  return toStudentDto(record);
}

/** Whether a STUDENT session may read this profile (own record only). */
export function studentOwnsRecord(
  sessionUserId: string,
  record: StudentRecord | Student,
): boolean {
  return record.userId === sessionUserId;
}
