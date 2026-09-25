import type {
  CreateTeacherRequest,
  Teacher,
  TeacherAvailability,
  TeacherLevel,
  UpdateTeacherRequest,
} from '@academia/shared';

export class TeacherConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeacherConflictError';
  }
}

export class TeacherNotFoundError extends Error {
  constructor(message = 'Teacher not found.') {
    super(message);
    this.name = 'TeacherNotFoundError';
  }
}

export class TeacherValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeacherValidationError';
  }
}

export interface TeacherRecord {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  level: TeacherLevel;
  availability: TeacherAvailability;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherStore {
  list(): Promise<TeacherRecord[]>;
  findById(id: string): Promise<TeacherRecord | null>;
  findByUserId(userId: string): Promise<TeacherRecord | null>;
  findUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    role: string;
    hasTeacher: boolean;
  } | null>;
  createWithNewUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    level: TeacherLevel;
    availability: TeacherAvailability;
    isActive: boolean;
  }): Promise<TeacherRecord>;
  createForExistingUser(input: {
    userId: string;
    firstName: string;
    lastName: string;
    level: TeacherLevel;
    availability: TeacherAvailability;
    isActive: boolean;
  }): Promise<TeacherRecord>;
  update(
    id: string,
    patch: {
      firstName?: string;
      lastName?: string;
      level?: TeacherLevel;
      availability?: TeacherAvailability;
      isActive?: boolean;
    },
  ): Promise<TeacherRecord>;
  /** Soft-deactivate teacher profile and linked User. */
  softDelete(id: string): Promise<TeacherRecord>;
}

export function toTeacherDto(record: TeacherRecord): Teacher {
  return {
    id: record.id,
    userId: record.userId,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    level: record.level,
    availability: record.availability,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listTeachers(store: TeacherStore): Promise<Teacher[]> {
  const rows = await store.list();
  return rows.map(toTeacherDto);
}

export async function getTeacher(
  store: TeacherStore,
  id: string,
): Promise<Teacher> {
  const row = await store.findById(id);
  if (!row) throw new TeacherNotFoundError();
  return toTeacherDto(row);
}

export async function createTeacher(
  store: TeacherStore,
  input: CreateTeacherRequest,
  hashPassword: (plain: string) => Promise<string>,
): Promise<Teacher> {
  const existing = await store.findUserByEmail(input.email);

  if (existing) {
    if (existing.role !== 'TEACHER') {
      throw new TeacherConflictError(
        'That email already belongs to a user with another role.',
      );
    }
    if (existing.hasTeacher) {
      throw new TeacherConflictError(
        'A teacher profile already exists for that email.',
      );
    }

    const record = await store.createForExistingUser({
      userId: existing.id,
      firstName: input.firstName,
      lastName: input.lastName,
      level: input.level,
      availability: input.availability ?? 'AVAILABLE',
      isActive: input.isActive ?? true,
    });
    return toTeacherDto(record);
  }

  if (!input.password) {
    throw new TeacherValidationError(
      'A password (min. 12 characters) is required to create a new teacher account.',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const record = await store.createWithNewUser({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    level: input.level,
    availability: input.availability ?? 'AVAILABLE',
    isActive: input.isActive ?? true,
  });
  return toTeacherDto(record);
}

export async function updateTeacher(
  store: TeacherStore,
  id: string,
  input: UpdateTeacherRequest,
): Promise<Teacher> {
  const existing = await store.findById(id);
  if (!existing) throw new TeacherNotFoundError();

  const record = await store.update(id, {
    firstName: input.firstName,
    lastName: input.lastName,
    level: input.level,
    availability: input.availability,
    isActive: input.isActive,
  });
  return toTeacherDto(record);
}

export async function deleteTeacher(
  store: TeacherStore,
  id: string,
): Promise<Teacher> {
  const existing = await store.findById(id);
  if (!existing) throw new TeacherNotFoundError();
  const record = await store.softDelete(id);
  return toTeacherDto(record);
}

/** Whether a TEACHER session may read this profile (own record only). */
export function teacherOwnsRecord(
  sessionUserId: string,
  record: TeacherRecord | Teacher,
): boolean {
  return record.userId === sessionUserId;
}
