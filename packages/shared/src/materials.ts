import { z } from 'zod';

/** Exact MIME allowlist for FILE materials. No SVG, video, or octet-stream. */
export const MATERIAL_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
] as const;

export type MaterialAllowedMimeType =
  (typeof MATERIAL_ALLOWED_MIME_TYPES)[number];

export const materialAllowedMimeTypeSchema = z.enum(MATERIAL_ALLOWED_MIME_TYPES);

export function isMaterialAllowedMimeType(
  value: string,
): value is MaterialAllowedMimeType {
  return (MATERIAL_ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/** Default byte limits (Stage 5A). Overridable via env on the API. */
export const MATERIAL_DEFAULT_MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MATERIAL_DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MATERIAL_DEFAULT_MAX_AUDIO_BYTES = 30 * 1024 * 1024;

export const MATERIAL_TITLE_MAX_LENGTH = 200;
export const MATERIAL_DESCRIPTION_MAX_LENGTH = 1000;
export const MATERIAL_FILENAME_MAX_LENGTH = 255;
export const MATERIAL_EXTERNAL_URL_MAX_LENGTH = 2048;

export const MATERIAL_KINDS = ['FILE', 'LINK'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];
export const materialKindSchema = z.enum(MATERIAL_KINDS);

export const MATERIAL_UPLOAD_STATUSES = ['PENDING', 'READY'] as const;
export type MaterialUploadStatus = (typeof MATERIAL_UPLOAD_STATUSES)[number];
export const materialUploadStatusSchema = z.enum(MATERIAL_UPLOAD_STATUSES);

const titleSchema = z
  .string()
  .trim()
  .min(1)
  .max(MATERIAL_TITLE_MAX_LENGTH);

const descriptionSchema = z
  .string()
  .trim()
  .max(MATERIAL_DESCRIPTION_MAX_LENGTH)
  .nullable()
  .optional();

/**
 * HTTPS absolute URL for LINK materials.
 * Rejects javascript/data/blob/file and non-https schemes. No server-side fetch.
 */
export function isSafeHttpsExternalUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MATERIAL_EXTERNAL_URL_MAX_LENGTH) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!parsed.hostname) return false;
  return true;
}

export const materialExternalUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MATERIAL_EXTERNAL_URL_MAX_LENGTH)
  .refine(isSafeHttpsExternalUrl, {
    message: 'externalUrl must be an absolute https URL',
  });

/**
 * Basename-only sanitization for originalFilename.
 * Never used as a storage key.
 */
export function sanitizeOriginalFilename(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip any directory component (POSIX and Windows).
  const base = trimmed.split(/[/\\]/).pop() ?? '';
  if (!base || base === '.' || base === '..') return null;
  if (base.includes('\0')) return null;
  if (base.length > MATERIAL_FILENAME_MAX_LENGTH) return null;
  // Reject residual path tricks after basename.
  if (base.includes('..') || base.includes('/') || base.includes('\\')) {
    return null;
  }
  return base;
}

export const materialOriginalFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MATERIAL_FILENAME_MAX_LENGTH)
  .refine((value) => sanitizeOriginalFilename(value) !== null, {
    message: 'originalFilename must be a safe basename',
  });

/** Public material metadata — never includes storageKey or credentials. */
export const materialSchema = z.object({
  id: z.string().uuid(),
  title: titleSchema,
  description: z.string().max(MATERIAL_DESCRIPTION_MAX_LENGTH).nullable(),
  kind: materialKindSchema,
  uploadStatus: materialUploadStatusSchema,
  mimeType: materialAllowedMimeTypeSchema.nullable(),
  sizeBytes: z.number().int().positive().nullable(),
  originalFilename: z.string().max(MATERIAL_FILENAME_MAX_LENGTH).nullable(),
  externalUrl: z.string().max(MATERIAL_EXTERNAL_URL_MAX_LENGTH).nullable(),
  courseId: z.string().uuid().nullable(),
  classSessionId: z.string().uuid().nullable(),
  createdByUserId: z.string().uuid(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Material = z.infer<typeof materialSchema>;

export const materialListResponseSchema = z.object({
  materials: z.array(materialSchema),
});

export type MaterialListResponse = z.infer<typeof materialListResponseSchema>;

export const materialResponseSchema = z.object({
  material: materialSchema,
});

export type MaterialResponse = z.infer<typeof materialResponseSchema>;

/** XOR association: exactly one of courseId / classSessionId. */
const associationFields = {
  courseId: z.string().uuid().optional(),
  classSessionId: z.string().uuid().optional(),
};

function refineXorAssociation(
  value: { courseId?: string; classSessionId?: string },
  ctx: z.RefinementCtx,
): void {
  const hasCourse = value.courseId !== undefined;
  const hasSession = value.classSessionId !== undefined;
  if (hasCourse === hasSession) {
    ctx.addIssue({
      code: 'custom',
      message: 'Exactly one of courseId or classSessionId is required',
      path: hasCourse ? ['courseId'] : ['courseId'],
    });
  }
}

/** Create LINK material (READY immediately). */
export const createMaterialLinkRequestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    kind: z.literal('LINK'),
    externalUrl: materialExternalUrlSchema,
    ...associationFields,
  })
  .superRefine(refineXorAssociation);

export type CreateMaterialLinkRequest = z.infer<
  typeof createMaterialLinkRequestSchema
>;

/** Alias used by OpenAPI / routes for POST /materials (LINK only). */
export const createMaterialRequestSchema = createMaterialLinkRequestSchema;
export type CreateMaterialRequest = CreateMaterialLinkRequest;

/** Intent to upload a FILE — returns PENDING material + presigned PUT URL. */
export const createMaterialUploadRequestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    mimeType: materialAllowedMimeTypeSchema,
    sizeBytes: z.number().int().positive(),
    originalFilename: materialOriginalFilenameSchema,
    ...associationFields,
  })
  .superRefine(refineXorAssociation);

export type CreateMaterialUploadRequest = z.infer<
  typeof createMaterialUploadRequestSchema
>;

export const materialUploadResponseSchema = z.object({
  material: materialSchema,
  uploadUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});

export type MaterialUploadResponse = z.infer<
  typeof materialUploadResponseSchema
>;

export const updateMaterialRequestSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema,
  })
  .refine(
    (value) => value.title !== undefined || value.description !== undefined,
    { message: 'At least one of title or description is required' },
  );

export type UpdateMaterialRequest = z.infer<typeof updateMaterialRequestSchema>;

export const materialDownloadResponseSchema = z.object({
  kind: materialKindSchema,
  /** Short-lived signed GET URL for FILE materials. */
  downloadUrl: z.string().url().optional(),
  expiresInSeconds: z.number().int().positive().optional(),
  /** Unchanged external HTTPS URL for LINK materials. */
  externalUrl: z.string().url().optional(),
});

export type MaterialDownloadResponse = z.infer<
  typeof materialDownloadResponseSchema
>;

export const materialListQuerySchema = z
  .object({
    courseId: z.string().uuid().optional(),
    classSessionId: z.string().uuid().optional(),
  })
  .superRefine(refineXorAssociation);

export type MaterialListQuery = z.infer<typeof materialListQuerySchema>;

/** Map MIME to size category for limit checks. */
export function materialSizeCategory(
  mimeType: MaterialAllowedMimeType,
): 'pdf' | 'image' | 'audio' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return 'audio';
}
