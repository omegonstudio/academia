import { randomUUID } from 'node:crypto';
import type {
  CreateOnlineCourseModuleRequest,
  CreateOnlineCourseRequest,
  CreateOnlineLessonAssetRequest,
  CreateOnlineLessonAssetUploadRequest,
  CreateOnlineLessonRequest,
  FinanceCurrency,
  OnlineCourse,
  OnlineCourseAccess,
  OnlineCourseAccessMode,
  OnlineCourseModule,
  OnlineCourseStatus,
  OnlineLesson,
  OnlineLessonAsset,
  OnlineLessonAssetDownloadResponse,
  OnlineLessonAssetKind,
  OnlineLessonAssetUploadResponse,
  OnlineLessonProgress,
  OnlineLessonProgressStatus,
  OnlineLessonStatus,
  OnlineLessonSubmission,
  OnlineQuizAdmin,
  OnlineQuizAttemptResult,
  OnlineQuizPublic,
  OnlineQuizQuestionType,
  OnlineSubmissionStatus,
  UpdateOnlineCourseModuleRequest,
  UpdateOnlineCourseRequest,
  UpdateOnlineLessonAssetRequest,
  UpdateOnlineLessonRequest,
  UpsertOnlineQuizRequest,
} from '@academia/shared';
import {
  isFinanceCurrency,
  isMaterialAllowedMimeType,
  isSafeHttpsExternalUrl,
  moneyMinorToString,
  parseMoneyMinor,
  sanitizeOriginalFilename,
} from '@academia/shared';
import type { ObjectStoragePort } from '../../storage/object-storage.js';
import {
  MATERIAL_MAGIC_PREFIX_BYTES,
  matchesMimeMagicBytes,
} from '../../storage/mime-magic.js';
import type {
  MaterialSizeLimits,
  MaterialUrlTtls,
} from '../materials/material-service.js';
import { maxBytesForMime } from '../materials/material-service.js';

export class OnlineCourseNotFoundError extends Error {
  constructor(message = 'Online course not found.') {
    super(message);
    this.name = 'OnlineCourseNotFoundError';
  }
}

export class OnlineCourseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnlineCourseValidationError';
  }
}

export class OnlineCourseForbiddenError extends Error {
  constructor(message = 'You are not allowed to access this online course.') {
    super(message);
    this.name = 'OnlineCourseForbiddenError';
  }
}

export class OnlineCourseConflictError extends Error {
  constructor(message = 'Online course conflict.') {
    super(message);
    this.name = 'OnlineCourseConflictError';
  }
}

export type { MaterialSizeLimits as OnlineLessonAssetSizeLimits };
export type { MaterialUrlTtls as OnlineLessonAssetUrlTtls };

export interface OnlineCourseRecord {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  authorTeacherId: string | null;
  authorName: string | null;
  coverImageUrl: string | null;
  benefits: string[];
  bonus: string[];
  status: OnlineCourseStatus;
  accessMode: OnlineCourseAccessMode;
  certificateEnabled: boolean;
  amountMinor: bigint | null;
  currency: FinanceCurrency | null;
  moduleCount?: number;
  lessonCount?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineCourseModuleRecord {
  id: string;
  onlineCourseId: string;
  title: string;
  description: string | null;
  position: number;
  lessonCount?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineLessonRecord {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  position: number;
  estimatedMinutes: number | null;
  isRequired: boolean;
  status: OnlineLessonStatus;
  acceptsSubmission: boolean;
  assetKinds?: OnlineLessonAssetKind[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineLessonAssetRecord {
  id: string;
  lessonId: string;
  kind: OnlineLessonAssetKind;
  title: string;
  position: number;
  bodyText: string | null;
  externalUrl: string | null;
  uploadStatus: 'PENDING' | 'READY' | null;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  originalFilename: string | null;
  createdByUserId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineCourseAccessRecord {
  id: string;
  onlineCourseId: string;
  studentId: string;
  isActive: boolean;
  grantedAt: Date;
  expiresAt: Date | null;
  grantedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineLessonProgressRecord {
  id: string;
  lessonId: string;
  studentId: string;
  status: OnlineLessonProgressStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  scorePercent: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineQuizOptionRecord {
  id: string;
  questionId: string;
  label: string;
  position: number;
  isCorrect: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineQuizQuestionRecord {
  id: string;
  quizId: string;
  prompt: string;
  type: OnlineQuizQuestionType;
  position: number;
  points: number;
  correctText: string | null;
  explanation: string | null;
  options: OnlineQuizOptionRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineQuizRecord {
  id: string;
  lessonId: string;
  title: string;
  passScorePercent: number | null;
  isActive: boolean;
  questions: OnlineQuizQuestionRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OnlineQuizAttemptRecord {
  id: string;
  quizId: string;
  studentId: string;
  scorePercent: number;
  passed: boolean;
  answersJson: unknown;
  createdAt: Date;
}

export interface OnlineLessonSubmissionRecord {
  id: string;
  lessonId: string;
  studentId: string;
  bodyText: string | null;
  status: OnlineSubmissionStatus;
  feedback: string | null;
  uploadStatus: 'PENDING' | 'READY' | null;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  originalFilename: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ordered lesson used for LINEAR gating and progress percent. */
export interface OnlineLessonOrderRef {
  id: string;
  moduleId: string;
  modulePosition: number;
  position: number;
  isRequired: boolean;
  status: OnlineLessonStatus;
  isActive: boolean;
  onlineCourseId: string;
}

export interface OnlineQuizQuestionInput {
  prompt: string;
  type: OnlineQuizQuestionType;
  points: number;
  correctText: string | null;
  explanation: string | null;
  options: Array<{ label: string; isCorrect: boolean }>;
}

/**
 * Persistence port for the online-courses domain.
 * Implementations: Prisma store and in-memory store for tests.
 */
export interface OnlineCourseStore {
  // —— Courses ——
  list(options?: { includeInactive?: boolean }): Promise<OnlineCourseRecord[]>;
  listPublished(): Promise<OnlineCourseRecord[]>;
  findById(id: string): Promise<OnlineCourseRecord | null>;
  findBySlug(slug: string): Promise<OnlineCourseRecord | null>;
  createCourse(input: {
    title: string;
    slug: string;
    subtitle: string | null;
    description: string | null;
    authorTeacherId: string | null;
    coverImageUrl: string | null;
    benefits: string[];
    bonus: string[];
    accessMode: OnlineCourseAccessMode;
    certificateEnabled: boolean;
    amountMinor: bigint | null;
    currency: FinanceCurrency | null;
  }): Promise<OnlineCourseRecord>;
  updateCourse(
    id: string,
    patch: {
      title?: string;
      slug?: string;
      subtitle?: string | null;
      description?: string | null;
      authorTeacherId?: string | null;
      coverImageUrl?: string | null;
      benefits?: string[];
      bonus?: string[];
      accessMode?: OnlineCourseAccessMode;
      certificateEnabled?: boolean;
      status?: OnlineCourseStatus;
      amountMinor?: bigint | null;
      currency?: FinanceCurrency | null;
      isActive?: boolean;
    },
  ): Promise<OnlineCourseRecord>;

  // —— Modules ——
  listModules(
    onlineCourseId: string,
    options?: { includeInactive?: boolean },
  ): Promise<OnlineCourseModuleRecord[]>;
  findModuleById(id: string): Promise<OnlineCourseModuleRecord | null>;
  createModule(input: {
    onlineCourseId: string;
    title: string;
    description: string | null;
    position: number;
  }): Promise<OnlineCourseModuleRecord>;
  updateModule(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      isActive?: boolean;
    },
  ): Promise<OnlineCourseModuleRecord>;
  reorderModules(
    onlineCourseId: string,
    moduleIds: string[],
  ): Promise<OnlineCourseModuleRecord[]>;
  nextModulePosition(onlineCourseId: string): Promise<number>;

  // —— Lessons ——
  listLessons(
    moduleId: string,
    options?: { includeInactive?: boolean },
  ): Promise<OnlineLessonRecord[]>;
  findLessonById(id: string): Promise<OnlineLessonRecord | null>;
  createLesson(input: {
    moduleId: string;
    title: string;
    description: string | null;
    position: number;
    estimatedMinutes: number | null;
    isRequired: boolean;
    status: OnlineLessonStatus;
    acceptsSubmission: boolean;
  }): Promise<OnlineLessonRecord>;
  updateLesson(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      estimatedMinutes?: number | null;
      isRequired?: boolean;
      status?: OnlineLessonStatus;
      acceptsSubmission?: boolean;
      isActive?: boolean;
    },
  ): Promise<OnlineLessonRecord>;
  reorderLessons(
    moduleId: string,
    lessonIds: string[],
  ): Promise<OnlineLessonRecord[]>;
  nextLessonPosition(moduleId: string): Promise<number>;
  /** Active published+draft lessons across the course, module/lesson position order. */
  listLessonOrderRefs(onlineCourseId: string): Promise<OnlineLessonOrderRef[]>;
  findCourseIdForLesson(lessonId: string): Promise<string | null>;

  // —— Assets ——
  listAssets(
    lessonId: string,
    options?: { includeInactive?: boolean },
  ): Promise<OnlineLessonAssetRecord[]>;
  findAssetById(id: string): Promise<OnlineLessonAssetRecord | null>;
  createAsset(input: {
    lessonId: string;
    kind: OnlineLessonAssetKind;
    title: string;
    position: number;
    bodyText: string | null;
    externalUrl: string | null;
    uploadStatus: 'PENDING' | 'READY' | null;
    mimeType: string | null;
    sizeBytes: number | null;
    storageKey: string | null;
    originalFilename: string | null;
    createdByUserId: string;
  }): Promise<OnlineLessonAssetRecord>;
  updateAsset(
    id: string,
    patch: {
      title?: string;
      bodyText?: string | null;
      externalUrl?: string | null;
      isActive?: boolean;
    },
  ): Promise<OnlineLessonAssetRecord | null>;
  markAssetReady(
    id: string,
    sizeBytes: number,
  ): Promise<OnlineLessonAssetRecord | null>;
  softDeleteAsset(id: string): Promise<OnlineLessonAssetRecord | null>;
  nextAssetPosition(lessonId: string): Promise<number>;

  // —— Access ——
  findAccess(
    onlineCourseId: string,
    studentId: string,
  ): Promise<OnlineCourseAccessRecord | null>;
  createAccess(input: {
    onlineCourseId: string;
    studentId: string;
    grantedByUserId: string | null;
    expiresAt: Date | null;
  }): Promise<OnlineCourseAccessRecord>;
  updateAccess(
    id: string,
    patch: {
      isActive?: boolean;
      grantedByUserId?: string | null;
      expiresAt?: Date | null;
      grantedAt?: Date;
    },
  ): Promise<OnlineCourseAccessRecord>;

  // —— Progress ——
  findProgress(
    lessonId: string,
    studentId: string,
  ): Promise<OnlineLessonProgressRecord | null>;
  listProgressForStudentInCourse(
    studentId: string,
    onlineCourseId: string,
  ): Promise<OnlineLessonProgressRecord[]>;
  upsertProgress(input: {
    lessonId: string;
    studentId: string;
    status: OnlineLessonProgressStatus;
    startedAt?: Date | null;
    completedAt?: Date | null;
    scorePercent?: number | null;
  }): Promise<OnlineLessonProgressRecord>;

  // —— Quiz ——
  findQuizByLessonId(lessonId: string): Promise<OnlineQuizRecord | null>;
  upsertQuiz(input: {
    lessonId: string;
    title: string;
    passScorePercent: number | null;
    questions: OnlineQuizQuestionInput[];
  }): Promise<OnlineQuizRecord>;
  createQuizAttempt(input: {
    quizId: string;
    studentId: string;
    scorePercent: number;
    passed: boolean;
    answersJson: unknown;
  }): Promise<OnlineQuizAttemptRecord>;

  // —— Submissions ——
  createSubmission(input: {
    lessonId: string;
    studentId: string;
    bodyText: string | null;
  }): Promise<OnlineLessonSubmissionRecord>;
  listSubmissionsByLessonAndStudent(
    lessonId: string,
    studentId: string,
  ): Promise<OnlineLessonSubmissionRecord[]>;
}

// —— Helpers ——

/** Strip script tags, javascript: URLs, and inline on* handlers from TEXT bodies. */
export function sanitizeOnlineLessonBodyText(raw: string): string {
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?script\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

export function parseStringListJson(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function buildOnlineLessonAssetStorageKey(now: Date = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `online-courses/${yyyy}/${mm}/${randomUUID()}`;
}

export function toOnlineCourseDto(record: OnlineCourseRecord): OnlineCourse {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    subtitle: record.subtitle,
    description: record.description,
    authorTeacherId: record.authorTeacherId,
    authorName: record.authorName ?? undefined,
    coverImageUrl: record.coverImageUrl,
    benefits: record.benefits,
    bonus: record.bonus,
    status: record.status,
    accessMode: record.accessMode,
    certificateEnabled: record.certificateEnabled,
    amountMinor:
      record.amountMinor === null
        ? null
        : moneyMinorToString(record.amountMinor),
    currency: record.currency,
    moduleCount: record.moduleCount,
    lessonCount: record.lessonCount,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toOnlineCourseModuleDto(
  record: OnlineCourseModuleRecord,
): OnlineCourseModule {
  return {
    id: record.id,
    onlineCourseId: record.onlineCourseId,
    title: record.title,
    description: record.description,
    position: record.position,
    lessonCount: record.lessonCount,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toOnlineLessonDto(record: OnlineLessonRecord): OnlineLesson {
  return {
    id: record.id,
    moduleId: record.moduleId,
    title: record.title,
    description: record.description,
    position: record.position,
    estimatedMinutes: record.estimatedMinutes,
    isRequired: record.isRequired,
    status: record.status,
    acceptsSubmission: record.acceptsSubmission,
    assetKinds: record.assetKinds,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toOnlineLessonAssetDto(
  record: OnlineLessonAssetRecord,
): OnlineLessonAsset {
  return {
    id: record.id,
    lessonId: record.lessonId,
    kind: record.kind,
    title: record.title,
    position: record.position,
    bodyText: record.bodyText,
    externalUrl: record.externalUrl,
    uploadStatus: record.uploadStatus,
    mimeType:
      record.mimeType && isMaterialAllowedMimeType(record.mimeType)
        ? record.mimeType
        : null,
    sizeBytes: record.sizeBytes,
    originalFilename: record.originalFilename,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toOnlineCourseAccessDto(
  record: OnlineCourseAccessRecord,
): OnlineCourseAccess {
  return {
    id: record.id,
    onlineCourseId: record.onlineCourseId,
    studentId: record.studentId,
    isActive: record.isActive,
    grantedAt: record.grantedAt.toISOString(),
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toOnlineLessonProgressDto(
  record: OnlineLessonProgressRecord,
): OnlineLessonProgress {
  return {
    lessonId: record.lessonId,
    status: record.status,
    startedAt: record.startedAt ? record.startedAt.toISOString() : null,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    scorePercent: record.scorePercent,
  };
}

export function toOnlineLessonSubmissionDto(
  record: OnlineLessonSubmissionRecord,
): OnlineLessonSubmission {
  return {
    id: record.id,
    lessonId: record.lessonId,
    studentId: record.studentId,
    bodyText: record.bodyText,
    status: record.status,
    feedback: record.feedback,
    uploadStatus: record.uploadStatus,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    originalFilename: record.originalFilename,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toOnlineQuizAdminDto(record: OnlineQuizRecord): OnlineQuizAdmin {
  return {
    id: record.id,
    lessonId: record.lessonId,
    title: record.title,
    passScorePercent: record.passScorePercent,
    isActive: record.isActive,
    questions: record.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      position: q.position,
      points: q.points,
      correctText: q.correctText,
      explanation: q.explanation,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        position: o.position,
        isCorrect: o.isCorrect,
      })),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toOnlineQuizPublicDto(record: OnlineQuizRecord): OnlineQuizPublic {
  return {
    id: record.id,
    title: record.title,
    passScorePercent: record.passScorePercent,
    questions: record.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      position: q.position,
      points: q.points,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        position: o.position,
      })),
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

function parseOptionalPrice(
  amountMinor: string | undefined,
  currency: FinanceCurrency | undefined,
): { amountMinor: bigint | null; currency: FinanceCurrency | null } {
  if (amountMinor === undefined && currency === undefined) {
    return { amountMinor: null, currency: null };
  }
  if (amountMinor === undefined || currency === undefined) {
    throw new OnlineCourseValidationError(
      'amountMinor and currency must be provided together.',
    );
  }
  const parsed = parseMoneyMinor(amountMinor);
  if (parsed < 0n) {
    throw new OnlineCourseValidationError('amountMinor must be non-negative.');
  }
  return { amountMinor: parsed, currency };
}

async function requireCourse(
  store: OnlineCourseStore,
  id: string,
): Promise<OnlineCourseRecord> {
  const row = await store.findById(id);
  if (!row) throw new OnlineCourseNotFoundError();
  return row;
}

async function requireModule(
  store: OnlineCourseStore,
  id: string,
): Promise<OnlineCourseModuleRecord> {
  const row = await store.findModuleById(id);
  if (!row) throw new OnlineCourseNotFoundError('Module not found.');
  return row;
}

async function requireLesson(
  store: OnlineCourseStore,
  id: string,
): Promise<OnlineLessonRecord> {
  const row = await store.findLessonById(id);
  if (!row) throw new OnlineCourseNotFoundError('Lesson not found.');
  return row;
}

// —— Course CRUD ——

export async function listOnlineCourses(
  store: OnlineCourseStore,
  options?: { includeInactive?: boolean },
): Promise<OnlineCourse[]> {
  return (await store.list(options)).map(toOnlineCourseDto);
}

export async function listPublishedOnlineCourses(
  store: OnlineCourseStore,
): Promise<OnlineCourse[]> {
  return (await store.listPublished()).map(toOnlineCourseDto);
}

export async function getOnlineCourse(
  store: OnlineCourseStore,
  id: string,
): Promise<OnlineCourse> {
  return toOnlineCourseDto(await requireCourse(store, id));
}

export async function getOnlineCourseBySlug(
  store: OnlineCourseStore,
  slug: string,
): Promise<OnlineCourse> {
  const row = await store.findBySlug(slug);
  if (!row) throw new OnlineCourseNotFoundError();
  return toOnlineCourseDto(row);
}

export async function createOnlineCourse(
  store: OnlineCourseStore,
  input: CreateOnlineCourseRequest,
): Promise<OnlineCourse> {
  const price = parseOptionalPrice(input.amountMinor, input.currency);
  try {
    const record = await store.createCourse({
      title: input.title,
      slug: input.slug,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      authorTeacherId: input.authorTeacherId ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      benefits: input.benefits ?? [],
      bonus: input.bonus ?? [],
      accessMode: input.accessMode ?? 'OPEN',
      certificateEnabled: input.certificateEnabled ?? false,
      amountMinor: price.amountMinor,
      currency: price.currency,
    });
    return toOnlineCourseDto(record);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new OnlineCourseConflictError(
        'An online course with this slug already exists.',
      );
    }
    throw error;
  }
}

export async function updateOnlineCourse(
  store: OnlineCourseStore,
  id: string,
  input: UpdateOnlineCourseRequest,
): Promise<OnlineCourse> {
  await requireCourse(store, id);

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
      if (!isFinanceCurrency(input.currency)) {
        throw new OnlineCourseValidationError('Invalid currency.');
      }
      const parsed = parseMoneyMinor(input.amountMinor);
      if (parsed < 0n) {
        throw new OnlineCourseValidationError(
          'amountMinor must be non-negative.',
        );
      }
      amountMinor = parsed;
      currency = input.currency;
    } else {
      throw new OnlineCourseValidationError(
        'amountMinor and currency must be cleared or set together.',
      );
    }
  }

  try {
    const record = await store.updateCourse(id, {
      title: input.title,
      slug: input.slug,
      subtitle: input.subtitle,
      description: input.description,
      authorTeacherId: input.authorTeacherId,
      coverImageUrl: input.coverImageUrl,
      benefits: input.benefits,
      bonus: input.bonus,
      accessMode: input.accessMode,
      certificateEnabled: input.certificateEnabled,
      status: input.status,
      amountMinor,
      currency,
      isActive: input.isActive,
    });
    return toOnlineCourseDto(record);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new OnlineCourseConflictError(
        'An online course with this slug already exists.',
      );
    }
    throw error;
  }
}

/** Publish via status=PUBLISHED. */
export async function publishOnlineCourse(
  store: OnlineCourseStore,
  id: string,
): Promise<OnlineCourse> {
  return updateOnlineCourse(store, id, { status: 'PUBLISHED' });
}

/** Archive via status=ARCHIVED. */
export async function archiveOnlineCourse(
  store: OnlineCourseStore,
  id: string,
): Promise<OnlineCourse> {
  return updateOnlineCourse(store, id, { status: 'ARCHIVED' });
}

/** Soft-delete: isActive=false (content with progress is never hard-deleted). */
export async function softDeleteOnlineCourse(
  store: OnlineCourseStore,
  id: string,
): Promise<OnlineCourse> {
  return updateOnlineCourse(store, id, { isActive: false });
}

// —— Modules ——

export async function listOnlineCourseModules(
  store: OnlineCourseStore,
  onlineCourseId: string,
  options?: { includeInactive?: boolean },
): Promise<OnlineCourseModule[]> {
  await requireCourse(store, onlineCourseId);
  return (await store.listModules(onlineCourseId, options)).map(
    toOnlineCourseModuleDto,
  );
}

export async function createOnlineCourseModule(
  store: OnlineCourseStore,
  onlineCourseId: string,
  input: CreateOnlineCourseModuleRequest,
): Promise<OnlineCourseModule> {
  await requireCourse(store, onlineCourseId);
  const position =
    input.position ?? (await store.nextModulePosition(onlineCourseId));
  const record = await store.createModule({
    onlineCourseId,
    title: input.title,
    description: input.description ?? null,
    position,
  });
  return toOnlineCourseModuleDto(record);
}

export async function updateOnlineCourseModule(
  store: OnlineCourseStore,
  moduleId: string,
  input: UpdateOnlineCourseModuleRequest,
): Promise<OnlineCourseModule> {
  await requireModule(store, moduleId);
  const record = await store.updateModule(moduleId, {
    title: input.title,
    description: input.description,
    isActive: input.isActive,
  });
  return toOnlineCourseModuleDto(record);
}

export async function reorderOnlineCourseModules(
  store: OnlineCourseStore,
  onlineCourseId: string,
  moduleIds: string[],
): Promise<OnlineCourseModule[]> {
  await requireCourse(store, onlineCourseId);
  const existing = await store.listModules(onlineCourseId, {
    includeInactive: false,
  });
  const existingIds = new Set(existing.map((m) => m.id));
  if (
    moduleIds.length !== existingIds.size ||
    moduleIds.some((id) => !existingIds.has(id))
  ) {
    throw new OnlineCourseValidationError(
      'moduleIds must be a permutation of the course active modules.',
    );
  }
  return (await store.reorderModules(onlineCourseId, moduleIds)).map(
    toOnlineCourseModuleDto,
  );
}

// —— Lessons ——

export async function listOnlineLessons(
  store: OnlineCourseStore,
  moduleId: string,
  options?: { includeInactive?: boolean },
): Promise<OnlineLesson[]> {
  await requireModule(store, moduleId);
  return (await store.listLessons(moduleId, options)).map(toOnlineLessonDto);
}

export async function getOnlineLesson(
  store: OnlineCourseStore,
  lessonId: string,
): Promise<OnlineLesson> {
  return toOnlineLessonDto(await requireLesson(store, lessonId));
}

export async function createOnlineLesson(
  store: OnlineCourseStore,
  moduleId: string,
  input: CreateOnlineLessonRequest,
): Promise<OnlineLesson> {
  await requireModule(store, moduleId);
  const position =
    input.position ?? (await store.nextLessonPosition(moduleId));
  const record = await store.createLesson({
    moduleId,
    title: input.title,
    description: input.description ?? null,
    position,
    estimatedMinutes: input.estimatedMinutes ?? null,
    isRequired: input.isRequired ?? true,
    status: input.status ?? 'DRAFT',
    acceptsSubmission: input.acceptsSubmission ?? false,
  });
  return toOnlineLessonDto(record);
}

export async function updateOnlineLesson(
  store: OnlineCourseStore,
  lessonId: string,
  input: UpdateOnlineLessonRequest,
): Promise<OnlineLesson> {
  await requireLesson(store, lessonId);
  const record = await store.updateLesson(lessonId, {
    title: input.title,
    description: input.description,
    estimatedMinutes: input.estimatedMinutes,
    isRequired: input.isRequired,
    status: input.status,
    acceptsSubmission: input.acceptsSubmission,
    isActive: input.isActive,
  });
  return toOnlineLessonDto(record);
}

export async function reorderOnlineLessons(
  store: OnlineCourseStore,
  moduleId: string,
  lessonIds: string[],
): Promise<OnlineLesson[]> {
  await requireModule(store, moduleId);
  const existing = await store.listLessons(moduleId, {
    includeInactive: false,
  });
  const existingIds = new Set(existing.map((l) => l.id));
  if (
    lessonIds.length !== existingIds.size ||
    lessonIds.some((id) => !existingIds.has(id))
  ) {
    throw new OnlineCourseValidationError(
      'lessonIds must be a permutation of the module active lessons.',
    );
  }
  return (await store.reorderLessons(moduleId, lessonIds)).map(
    toOnlineLessonDto,
  );
}

// —— Assets ——

export async function listOnlineLessonAssets(
  store: OnlineCourseStore,
  lessonId: string,
  options?: { includeInactive?: boolean },
): Promise<OnlineLessonAsset[]> {
  await requireLesson(store, lessonId);
  return (await store.listAssets(lessonId, options)).map(toOnlineLessonAssetDto);
}

export async function createOnlineLessonAsset(
  store: OnlineCourseStore,
  lessonId: string,
  createdByUserId: string,
  input: CreateOnlineLessonAssetRequest,
): Promise<OnlineLessonAsset> {
  await requireLesson(store, lessonId);

  if (input.kind === 'DOCUMENT') {
    throw new OnlineCourseValidationError(
      'DOCUMENT assets must be created via the upload endpoint.',
    );
  }

  let bodyText: string | null = null;
  let externalUrl: string | null = null;

  if (input.kind === 'TEXT') {
    if (!input.bodyText) {
      throw new OnlineCourseValidationError(
        'bodyText is required for TEXT assets.',
      );
    }
    bodyText = sanitizeOnlineLessonBodyText(input.bodyText);
  }

  if (input.kind === 'LINK' || input.kind === 'VIDEO') {
    if (!input.externalUrl) {
      throw new OnlineCourseValidationError(
        'externalUrl is required for LINK and VIDEO assets.',
      );
    }
    if (!isSafeHttpsExternalUrl(input.externalUrl)) {
      throw new OnlineCourseValidationError(
        'externalUrl must be an absolute https URL.',
      );
    }
    externalUrl = input.externalUrl.trim();
  }

  const position =
    input.position ?? (await store.nextAssetPosition(lessonId));
  const record = await store.createAsset({
    lessonId,
    kind: input.kind,
    title: input.title,
    position,
    bodyText,
    externalUrl,
    uploadStatus: null,
    mimeType: null,
    sizeBytes: null,
    storageKey: null,
    originalFilename: null,
    createdByUserId,
  });
  return toOnlineLessonAssetDto(record);
}

export async function createOnlineLessonAssetUpload(
  store: OnlineCourseStore,
  storage: ObjectStoragePort,
  lessonId: string,
  createdByUserId: string,
  input: CreateOnlineLessonAssetUploadRequest,
  limits: MaterialSizeLimits,
  ttls: MaterialUrlTtls,
): Promise<OnlineLessonAssetUploadResponse> {
  await requireLesson(store, lessonId);

  if (!isMaterialAllowedMimeType(input.mimeType)) {
    throw new OnlineCourseValidationError('mimeType is not allowed.');
  }

  const maxBytes = maxBytesForMime(input.mimeType, limits);
  if (input.sizeBytes > maxBytes) {
    throw new OnlineCourseValidationError(
      `sizeBytes exceeds the limit of ${maxBytes} bytes for this type.`,
    );
  }

  const filename = sanitizeOriginalFilename(input.originalFilename);
  if (!filename) {
    throw new OnlineCourseValidationError(
      'originalFilename must be a safe basename.',
    );
  }

  const storageKey = buildOnlineLessonAssetStorageKey();
  const position =
    input.position ?? (await store.nextAssetPosition(lessonId));
  const record = await store.createAsset({
    lessonId,
    kind: 'DOCUMENT',
    title: input.title,
    position,
    bodyText: null,
    externalUrl: null,
    uploadStatus: 'PENDING',
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storageKey,
    originalFilename: filename,
    createdByUserId,
  });

  const uploadUrl = await storage.createPresignedPutUrl({
    key: storageKey,
    contentType: input.mimeType,
    contentLength: input.sizeBytes,
    expiresInSeconds: ttls.uploadUrlTtlSeconds,
  });

  return {
    asset: toOnlineLessonAssetDto(record),
    uploadUrl,
  };
}

export async function completeOnlineLessonAssetUpload(
  store: OnlineCourseStore,
  storage: ObjectStoragePort,
  assetId: string,
  limits: MaterialSizeLimits,
): Promise<OnlineLessonAsset> {
  const record = await store.findAssetById(assetId);
  if (!record || !record.isActive) throw new OnlineCourseNotFoundError('Asset not found.');

  if (record.kind !== 'DOCUMENT') {
    throw new OnlineCourseValidationError(
      'Only DOCUMENT assets can be completed.',
    );
  }
  if (record.uploadStatus !== 'PENDING') {
    throw new OnlineCourseValidationError('Asset is not pending upload.');
  }
  if (!record.storageKey || !record.mimeType || record.sizeBytes === null) {
    throw new OnlineCourseValidationError('Asset is missing file metadata.');
  }
  if (!isMaterialAllowedMimeType(record.mimeType)) {
    throw new OnlineCourseValidationError('Stored mimeType is not allowed.');
  }

  const head = await storage.head(record.storageKey);
  if (!head) {
    throw new OnlineCourseValidationError(
      'Uploaded object was not found in storage.',
    );
  }

  const maxBytes = maxBytesForMime(record.mimeType, limits);
  if (head.contentLength <= 0 || head.contentLength > maxBytes) {
    throw new OnlineCourseValidationError(
      'Uploaded object size exceeds the configured limit.',
    );
  }

  const prefix = await storage.getPrefix(
    record.storageKey,
    MATERIAL_MAGIC_PREFIX_BYTES,
  );
  if (!prefix || !matchesMimeMagicBytes(record.mimeType, prefix)) {
    throw new OnlineCourseValidationError(
      'Uploaded object content does not match the declared mimeType.',
    );
  }

  const ready = await store.markAssetReady(assetId, head.contentLength);
  if (!ready) throw new OnlineCourseNotFoundError('Asset not found.');
  return toOnlineLessonAssetDto(ready);
}

export async function updateOnlineLessonAsset(
  store: OnlineCourseStore,
  assetId: string,
  input: UpdateOnlineLessonAssetRequest,
): Promise<OnlineLessonAsset> {
  const existing = await store.findAssetById(assetId);
  if (!existing || !existing.isActive) {
    throw new OnlineCourseNotFoundError('Asset not found.');
  }

  let bodyText = input.bodyText;
  if (typeof bodyText === 'string') {
    bodyText = sanitizeOnlineLessonBodyText(bodyText);
  }

  if (input.externalUrl !== undefined && input.externalUrl !== null) {
    if (!isSafeHttpsExternalUrl(input.externalUrl)) {
      throw new OnlineCourseValidationError(
        'externalUrl must be an absolute https URL.',
      );
    }
  }

  const updated = await store.updateAsset(assetId, {
    title: input.title,
    bodyText,
    externalUrl: input.externalUrl,
    isActive: input.isActive,
  });
  if (!updated) throw new OnlineCourseNotFoundError('Asset not found.');
  return toOnlineLessonAssetDto(updated);
}

export async function softDeleteOnlineLessonAsset(
  store: OnlineCourseStore,
  storage: ObjectStoragePort,
  assetId: string,
  logError: (payload: Record<string, unknown>, message: string) => void,
): Promise<void> {
  const record = await store.findAssetById(assetId);
  if (!record || !record.isActive) {
    throw new OnlineCourseNotFoundError('Asset not found.');
  }

  const deleted = await store.softDeleteAsset(assetId);
  if (!deleted) throw new OnlineCourseNotFoundError('Asset not found.');

  if (record.kind === 'DOCUMENT' && record.storageKey) {
    try {
      await storage.delete(record.storageKey);
    } catch (error: unknown) {
      logError(
        {
          assetId,
          storageKey: record.storageKey,
          err: error instanceof Error ? error.message : String(error),
        },
        'Failed to delete online lesson asset object from storage after soft-delete',
      );
    }
  }
}

export async function downloadOnlineLessonAsset(
  store: OnlineCourseStore,
  storage: ObjectStoragePort,
  assetId: string,
  ttls: MaterialUrlTtls,
): Promise<OnlineLessonAssetDownloadResponse> {
  const record = await store.findAssetById(assetId);
  if (!record || !record.isActive) {
    throw new OnlineCourseNotFoundError('Asset not found.');
  }

  if (record.kind === 'LINK' || record.kind === 'VIDEO') {
    if (!record.externalUrl) {
      throw new OnlineCourseValidationError(
        `${record.kind} asset is missing externalUrl.`,
      );
    }
    return {
      kind: record.kind,
      externalUrl: record.externalUrl,
    };
  }

  if (record.kind === 'TEXT') {
    return { kind: 'TEXT' };
  }

  // DOCUMENT
  if (record.uploadStatus !== 'READY' || !record.storageKey) {
    throw new OnlineCourseForbiddenError();
  }

  const disposition = record.originalFilename
    ? `attachment; filename="${record.originalFilename.replace(/"/g, '')}"`
    : undefined;

  const downloadUrl = await storage.getSignedGetUrl({
    key: record.storageKey,
    expiresInSeconds: ttls.downloadUrlTtlSeconds,
    responseContentDisposition: disposition,
  });

  return {
    kind: 'DOCUMENT',
    downloadUrl,
    expiresInSeconds: ttls.downloadUrlTtlSeconds,
  };
}

// Re-export attempt result type for quiz service consumers.
export type { OnlineQuizAttemptResult, UpsertOnlineQuizRequest };
