import {
  CLASS_SESSION_CALENDAR_MAX_DAYS,
  CLASS_SESSION_GENERATE_MAX_DAYS,
  addCivilDays,
  durationMinutesForServiceType,
  eachCivilDateInclusive,
  weekdayFromCivilDate,
  zonedLocalDateTimeToUtc,
  type ClassSession,
  type ClassSessionCalendarEvent,
  type ClassSessionCalendarQuery,
  type ClassSessionCalendarResponse,
  type CourseServiceType,
  type CourseType,
  type CreateClassSessionRequest,
  type GenerateClassSessionsRequest,
  type GenerateClassSessionsResponse,
  type UpdateClassSessionRequest,
  type Weekday,
} from '@academia/shared';
import type { AcademyBusinessConfig } from '../academy/academy-config.js';

export class ClassSessionNotFoundError extends Error {
  constructor(message = 'Class session not found.') {
    super(message);
    this.name = 'ClassSessionNotFoundError';
  }
}

export class ClassSessionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassSessionValidationError';
  }
}

export class ClassSessionConflictError extends Error {
  constructor(
    message = 'Class session conflicts with another session for the same teacher.',
  ) {
    super(message);
    this.name = 'ClassSessionConflictError';
  }
}

export class ClassSessionForbiddenError extends Error {
  constructor(message = 'You are not allowed to access this class session.') {
    super(message);
    this.name = 'ClassSessionForbiddenError';
  }
}

/**
 * Read access for ClassSession queries.
 * - `all`: caller has classes.read (admin / granted role).
 * - `teacher`: Group.teacherId must match (session user → Teacher profile).
 * - `student`: active Enrollment must exist for the student on the Group.
 */
export type ClassSessionReadScope =
  | { mode: 'all' }
  | { mode: 'teacher'; teacherId: string }
  | { mode: 'student'; studentId: string };

export interface ClassSessionListFilter {
  groupId?: string;
  scope?: ClassSessionReadScope;
}

export interface ClassSessionRecord {
  id: string;
  groupId: string;
  startAt: Date;
  endAt: Date;
  meetingUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassSessionGroupContext {
  id: string;
  isActive: boolean;
  teacherId: string | null;
  scheduleOptionId: string | null;
  serviceType: CourseServiceType;
  courseIsActive: boolean;
  scheduleOptionActive: boolean | null;
  scheduleDay: Weekday | null;
  scheduleStartTime: string | null;
}

export interface ClassSessionInterval {
  startAt: Date;
  endAt: Date;
}

/**
 * Half-open style overlap on absolute instants:
 * existing.startAt < candidate.endAt AND existing.endAt > candidate.startAt.
 * Touching endpoints (11:00–12:00 vs 10:00–11:00) do not conflict.
 */
export function intervalsOverlap(
  a: ClassSessionInterval,
  b: ClassSessionInterval,
): boolean {
  return a.startAt < b.endAt && a.endAt > b.startAt;
}

export interface ClassSessionCalendarRecord {
  id: string;
  startAt: Date;
  endAt: Date;
  meetingUrl: string | null;
  group: {
    id: string;
    name: string;
    course: {
      id: string;
      name: string;
      serviceType: CourseServiceType;
      courseType: CourseType;
    };
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface ClassSessionStore {
  list(filter?: ClassSessionListFilter): Promise<ClassSessionRecord[]>;
  findById(id: string): Promise<ClassSessionRecord | null>;
  findGroupContext(groupId: string): Promise<ClassSessionGroupContext | null>;
  /**
   * True when the student has an active Enrollment on the group.
   */
  hasActiveEnrollment(
    groupId: string,
    studentId: string,
  ): Promise<boolean>;
  /**
   * Active sessions whose startAt is in [rangeStart, rangeEndExclusive).
   * Ordered by startAt ASC, id ASC. Joins Group → Course / Teacher.
   */
  listCalendarRange(input: {
    rangeStart: Date;
    rangeEndExclusive: Date;
    scope?: ClassSessionReadScope;
  }): Promise<ClassSessionCalendarRecord[]>;
  /**
   * Active sessions of groups assigned to this teacher that overlap [startAt, endAt).
   * Teacher is resolved via Group.teacherId (not denormalized on ClassSession).
   */
  findActiveOverlappingForTeacher(input: {
    teacherId: string;
    startAt: Date;
    endAt: Date;
    excludeSessionId?: string;
  }): Promise<ClassSessionRecord | null>;
  /**
   * Serializes schedule mutations for one teacher (Postgres FOR UPDATE on teachers).
   * `fn` receives a store bound to the same transaction/connection as the lock.
   * When teacherId is null, runs fn with the root store (no lock).
   */
  withTeacherScheduleLock<T>(
    teacherId: string | null,
    fn: (locked: ClassSessionStore) => Promise<T>,
  ): Promise<T>;
  create(input: {
    groupId: string;
    startAt: Date;
    endAt: Date;
    meetingUrl: string | null;
    isActive: boolean;
  }): Promise<ClassSessionRecord>;
  /**
   * Inserts sessions; skips rows that violate UNIQUE(groupId, startAt).
   * Returns how many were inserted vs skipped as duplicates.
   */
  createManySkippingDuplicates(
    inputs: Array<{
      groupId: string;
      startAt: Date;
      endAt: Date;
      meetingUrl: string | null;
      isActive: boolean;
    }>,
  ): Promise<{ created: ClassSessionRecord[]; skippedCount: number }>;
  update(
    id: string,
    patch: {
      startAt?: Date;
      endAt?: Date;
      meetingUrl?: string | null;
      isActive?: boolean;
    },
  ): Promise<ClassSessionRecord>;
  softDelete(id: string): Promise<ClassSessionRecord>;
}

function addMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

function assertValidStartAt(startAt: Date): void {
  if (Number.isNaN(startAt.getTime())) {
    throw new ClassSessionValidationError('Invalid startAt.');
  }
}

function assertIntervalMatchesDuration(
  startAt: Date,
  endAt: Date,
  durationMinutes: 60 | 90 | 120,
): void {
  const actual = (endAt.getTime() - startAt.getTime()) / 60_000;
  if (actual !== durationMinutes) {
    throw new ClassSessionValidationError(
      `Class duration must be exactly ${durationMinutes} minutes.`,
    );
  }
}

export function toClassSessionDto(
  record: ClassSessionRecord,
  context: ClassSessionGroupContext,
): ClassSession {
  const durationMinutes = durationMinutesForServiceType(context.serviceType);
  return {
    id: record.id,
    groupId: record.groupId,
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    serviceType: context.serviceType,
    durationMinutes,
    scheduleOptionId: context.scheduleOptionId,
    teacherId: context.teacherId,
    meetingUrl: record.meetingUrl,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function requireGroupContext(
  store: ClassSessionStore,
  groupId: string,
): Promise<ClassSessionGroupContext> {
  const context = await store.findGroupContext(groupId);
  if (!context) {
    throw new ClassSessionValidationError('Group not found.');
  }
  return context;
}

function assertGroupReadyForSession(context: ClassSessionGroupContext): void {
  if (!context.isActive) {
    throw new ClassSessionValidationError('Group is inactive.');
  }
  if (!context.courseIsActive) {
    throw new ClassSessionValidationError('Course is inactive.');
  }
  if (!context.scheduleOptionId) {
    throw new ClassSessionValidationError(
      'Group has no schedule option assigned.',
    );
  }
  if (context.scheduleOptionActive === false) {
    throw new ClassSessionValidationError('Schedule option is inactive.');
  }
}

function assertRange(input: GenerateClassSessionsRequest): void {
  const days = eachCivilDateInclusive(input.from, input.to).length;
  if (days > CLASS_SESSION_GENERATE_MAX_DAYS) {
    throw new ClassSessionValidationError(
      `Date range must not exceed ${CLASS_SESSION_GENERATE_MAX_DAYS} days.`,
    );
  }
}

function assertCalendarRange(input: ClassSessionCalendarQuery): void {
  if (input.from > input.to) {
    throw new ClassSessionValidationError('to must be on or after from.');
  }
  const days = eachCivilDateInclusive(input.from, input.to).length;
  if (days > CLASS_SESSION_CALENDAR_MAX_DAYS) {
    throw new ClassSessionValidationError(
      `Date range must not exceed ${CLASS_SESSION_CALENDAR_MAX_DAYS} days.`,
    );
  }
}

function toCalendarEventDto(
  record: ClassSessionCalendarRecord,
): ClassSessionCalendarEvent {
  const durationMinutes = durationMinutesForServiceType(
    record.group.course.serviceType,
  );
  return {
    id: record.id,
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    durationMinutes,
    meetingUrl: record.meetingUrl,
    group: {
      id: record.group.id,
      name: record.group.name,
      course: {
        id: record.group.course.id,
        name: record.group.course.name,
        serviceType: record.group.course.serviceType,
        courseType: record.group.course.courseType,
      },
    },
    teacher: record.teacher
      ? {
          id: record.teacher.id,
          firstName: record.teacher.firstName,
          lastName: record.teacher.lastName,
        }
      : null,
  };
}

/**
 * Civil [from, to] inclusive in academy timezone → half-open absolute window
 * [from 00:00 local, dayAfter(to) 00:00 local). Sessions match by startAt.
 */
export async function listClassSessionsForCalendar(
  store: ClassSessionStore,
  query: ClassSessionCalendarQuery,
  academy: AcademyBusinessConfig,
  scope: ClassSessionReadScope = { mode: 'all' },
): Promise<ClassSessionCalendarResponse> {
  assertCalendarRange(query);

  const rangeStart = zonedLocalDateTimeToUtc(
    query.from,
    '00:00',
    academy.businessTimezone,
  );
  const rangeEndExclusive = zonedLocalDateTimeToUtc(
    addCivilDays(query.to, 1),
    '00:00',
    academy.businessTimezone,
  );

  const rows = await store.listCalendarRange({
    rangeStart,
    rangeEndExclusive,
    scope,
  });

  return {
    from: query.from,
    to: query.to,
    classSessions: rows.map(toCalendarEventDto),
  };
}

async function assertReadableByScope(
  store: ClassSessionStore,
  record: ClassSessionRecord,
  scope: ClassSessionReadScope,
): Promise<void> {
  if (scope.mode === 'all') return;

  if (scope.mode === 'teacher') {
    const context = await store.findGroupContext(record.groupId);
    if (context?.teacherId === scope.teacherId) return;
    throw new ClassSessionForbiddenError();
  }

  const enrolled = await store.hasActiveEnrollment(
    record.groupId,
    scope.studentId,
  );
  if (enrolled) return;
  throw new ClassSessionForbiddenError();
}

async function assertNoTeacherConflict(
  store: ClassSessionStore,
  teacherId: string | null,
  interval: ClassSessionInterval,
  excludeSessionId?: string,
): Promise<void> {
  if (!teacherId) return;
  const overlap = await store.findActiveOverlappingForTeacher({
    teacherId,
    startAt: interval.startAt,
    endAt: interval.endAt,
    excludeSessionId,
  });
  if (overlap) {
    throw new ClassSessionConflictError();
  }
}

export async function generateClassSessionsForGroup(
  store: ClassSessionStore,
  groupId: string,
  input: GenerateClassSessionsRequest,
  academy: AcademyBusinessConfig,
): Promise<GenerateClassSessionsResponse> {
  assertRange(input);

  const context = await requireGroupContext(store, groupId);
  assertGroupReadyForSession(context);

  if (!context.scheduleDay || !context.scheduleStartTime) {
    throw new ClassSessionValidationError(
      'Group has no schedule option assigned.',
    );
  }

  const durationMinutes = durationMinutesForServiceType(context.serviceType);
  const candidates: Array<{
    groupId: string;
    startAt: Date;
    endAt: Date;
    meetingUrl: string | null;
    isActive: boolean;
  }> = [];

  for (const date of eachCivilDateInclusive(input.from, input.to)) {
    if (weekdayFromCivilDate(date) !== context.scheduleDay) {
      continue;
    }
    const startAt = zonedLocalDateTimeToUtc(
      date,
      context.scheduleStartTime,
      academy.businessTimezone,
    );
    const endAt = addMinutes(startAt, durationMinutes);
    assertIntervalMatchesDuration(startAt, endAt, durationMinutes);
    candidates.push({
      groupId,
      startAt,
      endAt,
      meetingUrl: null,
      isActive: true,
    });
  }

  return store.withTeacherScheduleLock(context.teacherId, async (locked) => {
    const existingRows = await locked.list({ groupId });
    const existingKeys = new Set(
      existingRows.map((row) => row.startAt.toISOString()),
    );

    const toCreate: typeof candidates = [];
    let skippedCount = 0;
    let conflictCount = 0;
    const acceptedThisBatch: ClassSessionInterval[] = [];

    for (const candidate of candidates) {
      if (existingKeys.has(candidate.startAt.toISOString())) {
        skippedCount += 1;
        continue;
      }

      if (context.teacherId) {
        const overlapsExisting = await locked.findActiveOverlappingForTeacher({
          teacherId: context.teacherId,
          startAt: candidate.startAt,
          endAt: candidate.endAt,
        });
        const overlapsBatch = acceptedThisBatch.some((interval) =>
          intervalsOverlap(interval, candidate),
        );
        if (overlapsExisting || overlapsBatch) {
          conflictCount += 1;
          continue;
        }
      }

      toCreate.push(candidate);
      acceptedThisBatch.push(candidate);
    }

    const { created, skippedCount: raceDuplicates } =
      await locked.createManySkippingDuplicates(toCreate);

    return {
      groupId,
      from: input.from,
      to: input.to,
      generatedCount: created.length,
      skippedCount: skippedCount + raceDuplicates,
      conflictCount,
      classSessions: created.map((row) => toClassSessionDto(row, context)),
    };
  });
}

export async function listClassSessions(
  store: ClassSessionStore,
  filter?: ClassSessionListFilter,
): Promise<ClassSession[]> {
  const rows = await store.list(filter);
  const results: ClassSession[] = [];
  for (const row of rows) {
    const context = await requireGroupContext(store, row.groupId);
    results.push(toClassSessionDto(row, context));
  }
  return results;
}

export async function getClassSession(
  store: ClassSessionStore,
  id: string,
  scope: ClassSessionReadScope = { mode: 'all' },
): Promise<ClassSession> {
  const row = await store.findById(id);
  if (!row) throw new ClassSessionNotFoundError();
  await assertReadableByScope(store, row, scope);
  const context = await requireGroupContext(store, row.groupId);
  return toClassSessionDto(row, context);
}

export async function createClassSession(
  store: ClassSessionStore,
  input: CreateClassSessionRequest,
): Promise<ClassSession> {
  const context = await requireGroupContext(store, input.groupId);
  assertGroupReadyForSession(context);

  const startAt = new Date(input.startAt);
  assertValidStartAt(startAt);
  const durationMinutes = durationMinutesForServiceType(context.serviceType);
  const endAt = addMinutes(startAt, durationMinutes);
  assertIntervalMatchesDuration(startAt, endAt, durationMinutes);

  return store.withTeacherScheduleLock(context.teacherId, async (locked) => {
    // Re-read in case teacher assignment changed while waiting for the lock.
    const lockedContext = await requireGroupContext(locked, input.groupId);
    assertGroupReadyForSession(lockedContext);
    await assertNoTeacherConflict(locked, lockedContext.teacherId, {
      startAt,
      endAt,
    });

    const record = await locked.create({
      groupId: input.groupId,
      startAt,
      endAt,
      meetingUrl: input.meetingUrl ?? null,
      isActive: true,
    });
    return toClassSessionDto(record, lockedContext);
  });
}

export async function updateClassSession(
  store: ClassSessionStore,
  id: string,
  input: UpdateClassSessionRequest,
): Promise<ClassSession> {
  const existing = await store.findById(id);
  if (!existing) throw new ClassSessionNotFoundError();

  const context = await requireGroupContext(store, existing.groupId);
  const durationMinutes = durationMinutesForServiceType(context.serviceType);

  let startAt = existing.startAt;
  let endAt = existing.endAt;
  const reschedule = input.startAt !== undefined;

  if (reschedule) {
    assertGroupReadyForSession(context);
    startAt = new Date(input.startAt!);
    assertValidStartAt(startAt);
    endAt = addMinutes(startAt, durationMinutes);
    assertIntervalMatchesDuration(startAt, endAt, durationMinutes);
  }

  if (!reschedule) {
    const record = await store.update(id, {
      isActive: input.isActive,
      meetingUrl: input.meetingUrl,
    });
    return toClassSessionDto(record, context);
  }

  return store.withTeacherScheduleLock(context.teacherId, async (locked) => {
    const lockedContext = await requireGroupContext(locked, existing.groupId);
    assertGroupReadyForSession(lockedContext);
    await assertNoTeacherConflict(
      locked,
      lockedContext.teacherId,
      { startAt, endAt },
      id,
    );

    const record = await locked.update(id, {
      startAt,
      endAt,
      isActive: input.isActive,
      meetingUrl: input.meetingUrl,
    });
    return toClassSessionDto(record, lockedContext);
  });
}

export async function deleteClassSession(
  store: ClassSessionStore,
  id: string,
): Promise<ClassSession> {
  const existing = await store.findById(id);
  if (!existing) throw new ClassSessionNotFoundError();
  const context = await requireGroupContext(store, existing.groupId);
  return toClassSessionDto(await store.softDelete(id), context);
}
