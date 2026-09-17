import { randomUUID } from 'node:crypto';
import type {
  CreateMaterialLinkRequest,
  CreateMaterialUploadRequest,
  Material,
  MaterialAllowedMimeType,
  MaterialDownloadResponse,
  MaterialKind,
  MaterialUploadResponse,
  MaterialUploadStatus,
  UpdateMaterialRequest,
} from '@academia/shared';
import {
  isMaterialAllowedMimeType,
  isSafeHttpsExternalUrl,
  materialSizeCategory,
  sanitizeOriginalFilename,
} from '@academia/shared';
import type { ObjectStoragePort } from '../../storage/object-storage.js';
import {
  MATERIAL_MAGIC_PREFIX_BYTES,
  matchesMimeMagicBytes,
} from '../../storage/mime-magic.js';

export class MaterialNotFoundError extends Error {
  constructor(message = 'Material not found.') {
    super(message);
    this.name = 'MaterialNotFoundError';
  }
}

export class MaterialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaterialValidationError';
  }
}

export class MaterialForbiddenError extends Error {
  constructor(message = 'You are not allowed to access this material.') {
    super(message);
    this.name = 'MaterialForbiddenError';
  }
}

export interface MaterialSizeLimits {
  maxPdfBytes: number;
  maxImageBytes: number;
  maxAudioBytes: number;
}

export interface MaterialUrlTtls {
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
}

export interface MaterialRecord {
  id: string;
  title: string;
  description: string | null;
  kind: MaterialKind;
  uploadStatus: MaterialUploadStatus;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  originalFilename: string | null;
  externalUrl: string | null;
  courseId: string | null;
  classSessionId: string | null;
  createdByUserId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialAssociationTarget {
  courseId: string | null;
  classSessionId: string | null;
  /** For ClassSession materials — group teacher and enrollment checks. */
  sessionGroupId: string | null;
  sessionIsActive: boolean;
  sessionGroupIsActive: boolean;
  sessionTeacherId: string | null;
  /** Course exists and is active (course materials). */
  courseIsActive: boolean;
}

/**
 * Read actor resolved at the HTTP layer.
 * - admin: materials.read (incl. SUPER_ADMIN/DIRECTOR bypass)
 * - teacher: Group.teacherId ownership
 * - student: enrollment entitlement (READY + active only)
 */
export type MaterialReadActor =
  | { mode: 'admin' }
  | { mode: 'teacher'; teacherId: string }
  | { mode: 'student'; studentId: string };

/**
 * Write actor for create/upload/complete/update/soft-delete.
 * - admin: materials.create | materials.update
 * - teacher: Group.teacherId ownership of the association target
 */
export type MaterialWriteActor =
  | { mode: 'admin' }
  | { mode: 'teacher'; teacherId: string };

export interface MaterialListFilter {
  courseId?: string;
  classSessionId?: string;
  actor: MaterialReadActor;
}

export interface MaterialStore {
  findById(id: string): Promise<MaterialRecord | null>;

  /**
   * Scoped list. Entitlement / ownership must be encoded in the query —
   * never load-all-then-filter in memory for authorization.
   */
  list(filter: MaterialListFilter): Promise<MaterialRecord[]>;

  create(input: {
    title: string;
    description: string | null;
    kind: MaterialKind;
    uploadStatus: MaterialUploadStatus;
    mimeType: string | null;
    sizeBytes: number | null;
    storageKey: string | null;
    originalFilename: string | null;
    externalUrl: string | null;
    courseId: string | null;
    classSessionId: string | null;
    createdByUserId: string;
  }): Promise<MaterialRecord>;

  updateMetadata(
    id: string,
    patch: { title?: string; description?: string | null },
  ): Promise<MaterialRecord | null>;

  markReady(id: string, sizeBytes: number): Promise<MaterialRecord | null>;

  softDelete(id: string): Promise<MaterialRecord | null>;

  /** Resolve association target for ownership / existence checks. */
  resolveAssociation(input: {
    courseId?: string;
    classSessionId?: string;
  }): Promise<MaterialAssociationTarget | null>;

  /** Teacher owns an active Group of this Course. */
  teacherOwnsCourse(teacherId: string, courseId: string): Promise<boolean>;

  /** Teacher owns the ClassSession's Group. */
  teacherOwnsClassSession(
    teacherId: string,
    classSessionId: string,
  ): Promise<boolean>;

  /**
   * Student entitlement for a Course material (DB-level predicate helper).
   * Active Enrollment in an active Group of that Course.
   */
  studentEntitledToCourse(
    studentId: string,
    courseId: string,
  ): Promise<boolean>;

  /**
   * Student entitlement for a ClassSession material.
   * Active Enrollment in the session's Group; session and group active.
   */
  studentEntitledToClassSession(
    studentId: string,
    classSessionId: string,
  ): Promise<boolean>;
}

export function toMaterialDto(record: MaterialRecord): Material {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    kind: record.kind,
    uploadStatus: record.uploadStatus,
    mimeType:
      record.mimeType && isMaterialAllowedMimeType(record.mimeType)
        ? record.mimeType
        : null,
    sizeBytes: record.sizeBytes,
    originalFilename: record.originalFilename,
    externalUrl: record.externalUrl,
    courseId: record.courseId,
    classSessionId: record.classSessionId,
    createdByUserId: record.createdByUserId,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function assertXorAssociation(input: {
  courseId?: string | null;
  classSessionId?: string | null;
}): { courseId: string | null; classSessionId: string | null } {
  const courseId = input.courseId ?? null;
  const classSessionId = input.classSessionId ?? null;
  const hasCourse = courseId !== null;
  const hasSession = classSessionId !== null;
  if (hasCourse === hasSession) {
    throw new MaterialValidationError(
      'Exactly one of courseId or classSessionId is required.',
    );
  }
  return { courseId, classSessionId };
}

export function maxBytesForMime(
  mimeType: MaterialAllowedMimeType,
  limits: MaterialSizeLimits,
): number {
  const category = materialSizeCategory(mimeType);
  if (category === 'pdf') return limits.maxPdfBytes;
  if (category === 'image') return limits.maxImageBytes;
  return limits.maxAudioBytes;
}

export function buildStorageKey(now: Date = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `materials/${yyyy}/${mm}/${randomUUID()}`;
}

async function assertWriteOwnsAssociation(
  store: MaterialStore,
  actor: MaterialWriteActor,
  association: { courseId: string | null; classSessionId: string | null },
): Promise<void> {
  if (actor.mode === 'admin') return;
  if (association.courseId) {
    const owns = await store.teacherOwnsCourse(
      actor.teacherId,
      association.courseId,
    );
    if (!owns) {
      throw new MaterialForbiddenError(
        'You are not allowed to manage materials for this course.',
      );
    }
    return;
  }
  if (association.classSessionId) {
    const owns = await store.teacherOwnsClassSession(
      actor.teacherId,
      association.classSessionId,
    );
    if (!owns) {
      throw new MaterialForbiddenError(
        'You are not allowed to manage materials for this class.',
      );
    }
  }
}

async function assertCanReadMaterial(
  store: MaterialStore,
  actor: MaterialReadActor,
  record: MaterialRecord,
): Promise<void> {
  if (!record.isActive) {
    // Inactive materials are inaccessible to everyone via read/download APIs.
    throw new MaterialNotFoundError();
  }

  if (actor.mode === 'admin') return;

  if (actor.mode === 'teacher') {
    if (record.courseId) {
      const owns = await store.teacherOwnsCourse(
        actor.teacherId,
        record.courseId,
      );
      if (!owns) throw new MaterialForbiddenError();
      return;
    }
    if (record.classSessionId) {
      const owns = await store.teacherOwnsClassSession(
        actor.teacherId,
        record.classSessionId,
      );
      if (!owns) throw new MaterialForbiddenError();
      return;
    }
    throw new MaterialForbiddenError();
  }

  // Student: READY only; entitlement in DB helpers.
  if (record.uploadStatus !== 'READY') {
    throw new MaterialForbiddenError();
  }
  if (record.courseId) {
    const entitled = await store.studentEntitledToCourse(
      actor.studentId,
      record.courseId,
    );
    if (!entitled) throw new MaterialForbiddenError();
    return;
  }
  if (record.classSessionId) {
    const entitled = await store.studentEntitledToClassSession(
      actor.studentId,
      record.classSessionId,
    );
    if (!entitled) throw new MaterialForbiddenError();
    return;
  }
  throw new MaterialForbiddenError();
}

export async function listMaterials(
  store: MaterialStore,
  filter: MaterialListFilter,
): Promise<Material[]> {
  assertXorAssociation({
    courseId: filter.courseId,
    classSessionId: filter.classSessionId,
  });
  const rows = await store.list(filter);
  return rows.map(toMaterialDto);
}

export async function getMaterial(
  store: MaterialStore,
  actor: MaterialReadActor,
  id: string,
): Promise<Material> {
  const record = await store.findById(id);
  if (!record) throw new MaterialNotFoundError();
  await assertCanReadMaterial(store, actor, record);
  return toMaterialDto(record);
}

export async function createLinkMaterial(
  store: MaterialStore,
  actor: MaterialWriteActor,
  createdByUserId: string,
  input: CreateMaterialLinkRequest,
): Promise<Material> {
  const association = assertXorAssociation(input);
  await assertWriteOwnsAssociation(store, actor, association);

  const target = await store.resolveAssociation({
    courseId: association.courseId ?? undefined,
    classSessionId: association.classSessionId ?? undefined,
  });
  if (!target) {
    throw new MaterialValidationError('Association target not found.');
  }

  if (!isSafeHttpsExternalUrl(input.externalUrl)) {
    throw new MaterialValidationError(
      'externalUrl must be an absolute https URL.',
    );
  }

  const record = await store.create({
    title: input.title,
    description: input.description ?? null,
    kind: 'LINK',
    uploadStatus: 'READY',
    mimeType: null,
    sizeBytes: null,
    storageKey: null,
    originalFilename: null,
    externalUrl: input.externalUrl.trim(),
    courseId: association.courseId,
    classSessionId: association.classSessionId,
    createdByUserId,
  });

  return toMaterialDto(record);
}

export async function createFileUploadIntent(
  store: MaterialStore,
  storage: ObjectStoragePort,
  actor: MaterialWriteActor,
  createdByUserId: string,
  input: CreateMaterialUploadRequest,
  limits: MaterialSizeLimits,
  ttls: MaterialUrlTtls,
): Promise<MaterialUploadResponse> {
  const association = assertXorAssociation(input);
  await assertWriteOwnsAssociation(store, actor, association);

  const target = await store.resolveAssociation({
    courseId: association.courseId ?? undefined,
    classSessionId: association.classSessionId ?? undefined,
  });
  if (!target) {
    throw new MaterialValidationError('Association target not found.');
  }

  if (!isMaterialAllowedMimeType(input.mimeType)) {
    throw new MaterialValidationError('mimeType is not allowed.');
  }

  const maxBytes = maxBytesForMime(input.mimeType, limits);
  if (input.sizeBytes > maxBytes) {
    throw new MaterialValidationError(
      `sizeBytes exceeds the limit of ${maxBytes} bytes for this type.`,
    );
  }

  const filename = sanitizeOriginalFilename(input.originalFilename);
  if (!filename) {
    throw new MaterialValidationError(
      'originalFilename must be a safe basename.',
    );
  }

  const storageKey = buildStorageKey();
  const record = await store.create({
    title: input.title,
    description: input.description ?? null,
    kind: 'FILE',
    uploadStatus: 'PENDING',
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storageKey,
    originalFilename: filename,
    externalUrl: null,
    courseId: association.courseId,
    classSessionId: association.classSessionId,
    createdByUserId,
  });

  const uploadUrl = await storage.createPresignedPutUrl({
    key: storageKey,
    contentType: input.mimeType,
    contentLength: input.sizeBytes,
    expiresInSeconds: ttls.uploadUrlTtlSeconds,
  });

  return {
    material: toMaterialDto(record),
    uploadUrl,
    expiresInSeconds: ttls.uploadUrlTtlSeconds,
  };
}

export async function completeMaterialUpload(
  store: MaterialStore,
  storage: ObjectStoragePort,
  actor: MaterialWriteActor,
  id: string,
  limits: MaterialSizeLimits,
): Promise<Material> {
  const record = await store.findById(id);
  if (!record || !record.isActive) throw new MaterialNotFoundError();

  await assertWriteOwnsAssociation(store, actor, {
    courseId: record.courseId,
    classSessionId: record.classSessionId,
  });

  if (record.kind !== 'FILE') {
    throw new MaterialValidationError('Only FILE materials can be completed.');
  }
  if (record.uploadStatus !== 'PENDING') {
    throw new MaterialValidationError('Material is not pending upload.');
  }
  if (!record.storageKey || !record.mimeType || record.sizeBytes === null) {
    throw new MaterialValidationError('Material is missing file metadata.');
  }
  if (!isMaterialAllowedMimeType(record.mimeType)) {
    throw new MaterialValidationError('Stored mimeType is not allowed.');
  }

  const head = await storage.head(record.storageKey);
  if (!head) {
    throw new MaterialValidationError(
      'Uploaded object was not found in storage.',
    );
  }

  const maxBytes = maxBytesForMime(record.mimeType, limits);
  if (head.contentLength <= 0 || head.contentLength > maxBytes) {
    throw new MaterialValidationError(
      'Uploaded object size exceeds the configured limit.',
    );
  }
  // Client-declared sizeBytes must not be smaller than reality either —
  // enforce the real size against the limit; declare mismatch if far off.
  if (head.contentLength !== record.sizeBytes) {
    // Allow completing when real size is within limit; update sizeBytes.
    // Reject if declared size was used to get a too-large signed PUT that
    // somehow stored more — already covered by maxBytes check above.
  }

  const prefix = await storage.getPrefix(
    record.storageKey,
    MATERIAL_MAGIC_PREFIX_BYTES,
  );
  if (!prefix || !matchesMimeMagicBytes(record.mimeType, prefix)) {
    throw new MaterialValidationError(
      'Uploaded object content does not match the declared mimeType.',
    );
  }

  const ready = await store.markReady(id, head.contentLength);
  if (!ready) throw new MaterialNotFoundError();
  return toMaterialDto(ready);
}

export async function updateMaterial(
  store: MaterialStore,
  actor: MaterialWriteActor,
  id: string,
  input: UpdateMaterialRequest,
): Promise<Material> {
  const record = await store.findById(id);
  if (!record || !record.isActive) throw new MaterialNotFoundError();

  await assertWriteOwnsAssociation(store, actor, {
    courseId: record.courseId,
    classSessionId: record.classSessionId,
  });

  const updated = await store.updateMetadata(id, {
    title: input.title,
    description: input.description,
  });
  if (!updated) throw new MaterialNotFoundError();
  return toMaterialDto(updated);
}

export async function softDeleteMaterial(
  store: MaterialStore,
  storage: ObjectStoragePort,
  actor: MaterialWriteActor,
  id: string,
  logError: (payload: Record<string, unknown>, message: string) => void,
): Promise<void> {
  const record = await store.findById(id);
  if (!record || !record.isActive) throw new MaterialNotFoundError();

  await assertWriteOwnsAssociation(store, actor, {
    courseId: record.courseId,
    classSessionId: record.classSessionId,
  });

  const deleted = await store.softDelete(id);
  if (!deleted) throw new MaterialNotFoundError();

  if (record.kind === 'FILE' && record.storageKey) {
    try {
      await storage.delete(record.storageKey);
    } catch (error: unknown) {
      logError(
        {
          materialId: id,
          storageKey: record.storageKey,
          err: error instanceof Error ? error.message : String(error),
        },
        'Failed to delete material object from storage after soft-delete',
      );
    }
  }
}

export async function downloadMaterial(
  store: MaterialStore,
  storage: ObjectStoragePort,
  actor: MaterialReadActor,
  id: string,
  ttls: MaterialUrlTtls,
): Promise<MaterialDownloadResponse> {
  const record = await store.findById(id);
  if (!record) throw new MaterialNotFoundError();
  await assertCanReadMaterial(store, actor, record);

  if (record.kind === 'LINK') {
    if (!record.externalUrl) {
      throw new MaterialValidationError('LINK material is missing externalUrl.');
    }
    return {
      kind: 'LINK',
      externalUrl: record.externalUrl,
    };
  }

  if (record.uploadStatus !== 'READY' || !record.storageKey) {
    throw new MaterialForbiddenError();
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
    kind: 'FILE',
    downloadUrl,
    expiresInSeconds: ttls.downloadUrlTtlSeconds,
  };
}
