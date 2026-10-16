import { z } from 'zod';
import {
  isSafeHttpsExternalUrl,
  materialExternalUrlSchema,
  MATERIAL_EXTERNAL_URL_MAX_LENGTH,
} from './materials.js';
import { financeCurrencySchema, moneyMinorStringSchema } from './finance.js';

export const ONLINE_COURSE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type OnlineCourseStatus = (typeof ONLINE_COURSE_STATUSES)[number];
export const onlineCourseStatusSchema = z.enum(ONLINE_COURSE_STATUSES);

export const ONLINE_COURSE_ACCESS_MODES = ['OPEN', 'LINEAR'] as const;
export type OnlineCourseAccessMode = (typeof ONLINE_COURSE_ACCESS_MODES)[number];
export const onlineCourseAccessModeSchema = z.enum(ONLINE_COURSE_ACCESS_MODES);

export const ONLINE_LESSON_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type OnlineLessonStatus = (typeof ONLINE_LESSON_STATUSES)[number];
export const onlineLessonStatusSchema = z.enum(ONLINE_LESSON_STATUSES);

export const ONLINE_LESSON_ASSET_KINDS = [
  'VIDEO',
  'DOCUMENT',
  'TEXT',
  'LINK',
] as const;
export type OnlineLessonAssetKind = (typeof ONLINE_LESSON_ASSET_KINDS)[number];
export const onlineLessonAssetKindSchema = z.enum(ONLINE_LESSON_ASSET_KINDS);

export const ONLINE_LESSON_PROGRESS_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;
export type OnlineLessonProgressStatus =
  (typeof ONLINE_LESSON_PROGRESS_STATUSES)[number];
export const onlineLessonProgressStatusSchema = z.enum(
  ONLINE_LESSON_PROGRESS_STATUSES,
);

export const ONLINE_QUIZ_QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_TEXT',
] as const;
export type OnlineQuizQuestionType =
  (typeof ONLINE_QUIZ_QUESTION_TYPES)[number];
export const onlineQuizQuestionTypeSchema = z.enum(ONLINE_QUIZ_QUESTION_TYPES);

export const ONLINE_SUBMISSION_STATUSES = ['SUBMITTED', 'REVIEWED'] as const;
export type OnlineSubmissionStatus =
  (typeof ONLINE_SUBMISSION_STATUSES)[number];
export const onlineSubmissionStatusSchema = z.enum(ONLINE_SUBMISSION_STATUSES);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  });

const stringListSchema = z.array(z.string().trim().min(1).max(500)).max(30);

const coverImageUrlSchema = z
  .string()
  .trim()
  .max(MATERIAL_EXTERNAL_URL_MAX_LENGTH)
  .refine(isSafeHttpsExternalUrl, {
    message: 'coverImageUrl must be an absolute https URL',
  })
  .nullable()
  .optional();

export const onlineCourseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  slug: slugSchema,
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  authorTeacherId: z.string().uuid().nullable(),
  authorName: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable(),
  benefits: z.array(z.string()),
  bonus: z.array(z.string()),
  status: onlineCourseStatusSchema,
  accessMode: onlineCourseAccessModeSchema,
  certificateEnabled: z.boolean(),
  amountMinor: z.string().regex(/^\d+$/).nullable(),
  currency: financeCurrencySchema.nullable(),
  moduleCount: z.number().int().nonnegative().optional(),
  lessonCount: z.number().int().nonnegative().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type OnlineCourse = z.infer<typeof onlineCourseSchema>;

export const onlineCourseListResponseSchema = z.object({
  courses: z.array(onlineCourseSchema),
});
export type OnlineCourseListResponse = z.infer<
  typeof onlineCourseListResponseSchema
>;

export const onlineCourseResponseSchema = z.object({
  course: onlineCourseSchema,
});
export type OnlineCourseResponse = z.infer<typeof onlineCourseResponseSchema>;

export const createOnlineCourseRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: slugSchema,
    subtitle: z.string().trim().max(300).optional(),
    description: z.string().trim().max(10000).optional(),
    authorTeacherId: z.string().uuid().nullable().optional(),
    coverImageUrl: coverImageUrlSchema,
    benefits: stringListSchema.optional(),
    bonus: stringListSchema.optional(),
    accessMode: onlineCourseAccessModeSchema.optional(),
    certificateEnabled: z.boolean().optional(),
    amountMinor: moneyMinorStringSchema.optional(),
    currency: financeCurrencySchema.optional(),
  })
  .refine(
    (value) =>
      (value.amountMinor === undefined) === (value.currency === undefined),
    { message: 'amountMinor and currency must be provided together.' },
  );

export type CreateOnlineCourseRequest = z.infer<
  typeof createOnlineCourseRequestSchema
>;

export const updateOnlineCourseRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    slug: slugSchema.optional(),
    subtitle: z.string().trim().max(300).nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    authorTeacherId: z.string().uuid().nullable().optional(),
    coverImageUrl: coverImageUrlSchema,
    benefits: stringListSchema.optional(),
    bonus: stringListSchema.optional(),
    accessMode: onlineCourseAccessModeSchema.optional(),
    certificateEnabled: z.boolean().optional(),
    status: onlineCourseStatusSchema.optional(),
    amountMinor: moneyMinorStringSchema.nullable().optional(),
    currency: financeCurrencySchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    { message: 'At least one field is required.' },
  )
  .refine(
    (value) => {
      const clearing =
        value.amountMinor === null || value.currency === null;
      const setting =
        typeof value.amountMinor === 'string' ||
        (value.currency !== undefined && value.currency !== null);
      if (clearing) {
        return value.amountMinor === null && value.currency === null;
      }
      if (setting) {
        return (
          typeof value.amountMinor === 'string' &&
          value.currency !== undefined &&
          value.currency !== null
        );
      }
      return true;
    },
    { message: 'amountMinor and currency must be cleared or set together.' },
  );

export type UpdateOnlineCourseRequest = z.infer<
  typeof updateOnlineCourseRequestSchema
>;

export const onlineCourseModuleSchema = z.object({
  id: z.string().uuid(),
  onlineCourseId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  position: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OnlineCourseModule = z.infer<typeof onlineCourseModuleSchema>;

export const createOnlineCourseModuleRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  position: z.number().int().nonnegative().optional(),
});
export type CreateOnlineCourseModuleRequest = z.infer<
  typeof createOnlineCourseModuleRequestSchema
>;

export const updateOnlineCourseModuleRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });
export type UpdateOnlineCourseModuleRequest = z.infer<
  typeof updateOnlineCourseModuleRequestSchema
>;

export const reorderOnlineCourseModulesRequestSchema = z.object({
  moduleIds: z.array(z.string().uuid()).min(1),
});
export type ReorderOnlineCourseModulesRequest = z.infer<
  typeof reorderOnlineCourseModulesRequestSchema
>;

export const onlineLessonSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  position: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive().nullable(),
  isRequired: z.boolean(),
  status: onlineLessonStatusSchema,
  acceptsSubmission: z.boolean(),
  assetKinds: z.array(onlineLessonAssetKindSchema).optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OnlineLesson = z.infer<typeof onlineLessonSchema>;

export const createOnlineLessonRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  estimatedMinutes: z.number().int().positive().max(24 * 60).optional(),
  isRequired: z.boolean().optional(),
  status: onlineLessonStatusSchema.optional(),
  acceptsSubmission: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});
export type CreateOnlineLessonRequest = z.infer<
  typeof createOnlineLessonRequestSchema
>;

export const updateOnlineLessonRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    estimatedMinutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60)
      .nullable()
      .optional(),
    isRequired: z.boolean().optional(),
    status: onlineLessonStatusSchema.optional(),
    acceptsSubmission: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });
export type UpdateOnlineLessonRequest = z.infer<
  typeof updateOnlineLessonRequestSchema
>;

export const reorderOnlineLessonsRequestSchema = z.object({
  lessonIds: z.array(z.string().uuid()).min(1),
});
export type ReorderOnlineLessonsRequest = z.infer<
  typeof reorderOnlineLessonsRequestSchema
>;

export const onlineLessonAssetSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  kind: onlineLessonAssetKindSchema,
  title: z.string().min(1).max(200),
  position: z.number().int().nonnegative(),
  bodyText: z.string().nullable(),
  externalUrl: z.string().nullable(),
  uploadStatus: z.enum(['PENDING', 'READY']).nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  originalFilename: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OnlineLessonAsset = z.infer<typeof onlineLessonAssetSchema>;

export const createOnlineLessonAssetRequestSchema = z
  .object({
    kind: onlineLessonAssetKindSchema,
    title: z.string().trim().min(1).max(200),
    bodyText: z.string().trim().max(50000).optional(),
    externalUrl: materialExternalUrlSchema.optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'TEXT' && !value.bodyText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bodyText is required for TEXT assets.',
        path: ['bodyText'],
      });
    }
    if (
      (value.kind === 'LINK' || value.kind === 'VIDEO') &&
      !value.externalUrl
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'externalUrl is required for LINK and VIDEO assets.',
        path: ['externalUrl'],
      });
    }
    if (value.kind === 'DOCUMENT') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DOCUMENT assets must be created via the upload endpoint.',
        path: ['kind'],
      });
    }
  });
export type CreateOnlineLessonAssetRequest = z.infer<
  typeof createOnlineLessonAssetRequestSchema
>;

export const createOnlineLessonAssetUploadRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  originalFilename: z.string().trim().min(1).max(255),
  position: z.number().int().nonnegative().optional(),
});
export type CreateOnlineLessonAssetUploadRequest = z.infer<
  typeof createOnlineLessonAssetUploadRequestSchema
>;

export const onlineLessonAssetUploadResponseSchema = z.object({
  asset: onlineLessonAssetSchema,
  uploadUrl: z.string().url(),
  uploadHeaders: z.record(z.string(), z.string()).optional(),
});
export type OnlineLessonAssetUploadResponse = z.infer<
  typeof onlineLessonAssetUploadResponseSchema
>;

export const updateOnlineLessonAssetRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    bodyText: z.string().trim().max(50000).nullable().optional(),
    externalUrl: materialExternalUrlSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });
export type UpdateOnlineLessonAssetRequest = z.infer<
  typeof updateOnlineLessonAssetRequestSchema
>;

export const onlineLessonAssetDownloadResponseSchema = z.object({
  kind: onlineLessonAssetKindSchema,
  downloadUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
  expiresInSeconds: z.number().int().positive().optional(),
});
export type OnlineLessonAssetDownloadResponse = z.infer<
  typeof onlineLessonAssetDownloadResponseSchema
>;

export const onlineCourseAccessSchema = z.object({
  id: z.string().uuid(),
  onlineCourseId: z.string().uuid(),
  studentId: z.string().uuid(),
  isActive: z.boolean(),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OnlineCourseAccess = z.infer<typeof onlineCourseAccessSchema>;

export const grantOnlineCourseAccessRequestSchema = z.object({
  studentId: z.string().uuid(),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type GrantOnlineCourseAccessRequest = z.infer<
  typeof grantOnlineCourseAccessRequestSchema
>;

export const onlineLessonProgressSchema = z.object({
  lessonId: z.string().uuid(),
  status: onlineLessonProgressStatusSchema,
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  scorePercent: z.number().int().min(0).max(100).nullable(),
});
export type OnlineLessonProgress = z.infer<typeof onlineLessonProgressSchema>;

export const updateOnlineLessonProgressRequestSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
});
export type UpdateOnlineLessonProgressRequest = z.infer<
  typeof updateOnlineLessonProgressRequestSchema
>;

/** Public catalogue card — never includes private asset URLs. */
export const publicOnlineCourseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: slugSchema,
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  authorName: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  benefits: z.array(z.string()),
  bonus: z.array(z.string()),
  accessMode: onlineCourseAccessModeSchema,
  certificateEnabled: z.boolean(),
  amountMinor: z.string().regex(/^\d+$/).nullable(),
  currency: financeCurrencySchema.nullable(),
  isFree: z.boolean(),
  modules: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      description: z.string().nullable(),
      position: z.number().int(),
      lessons: z.array(
        z.object({
          id: z.string().uuid(),
          title: z.string(),
          estimatedMinutes: z.number().int().nullable(),
          position: z.number().int(),
          assetKinds: z.array(onlineLessonAssetKindSchema),
        }),
      ),
    }),
  ),
});
export type PublicOnlineCourse = z.infer<typeof publicOnlineCourseSchema>;

export const publicOnlineCourseListResponseSchema = z.object({
  courses: z.array(publicOnlineCourseSchema.omit({ modules: true })),
});
export type PublicOnlineCourseListResponse = z.infer<
  typeof publicOnlineCourseListResponseSchema
>;

export const publicOnlineCourseResponseSchema = z.object({
  course: publicOnlineCourseSchema,
  hasAccess: z.boolean().optional(),
});
export type PublicOnlineCourseResponse = z.infer<
  typeof publicOnlineCourseResponseSchema
>;

export const studentOnlineCourseOutlineSchema = z.object({
  course: onlineCourseSchema,
  progressPercent: z.number().min(0).max(100),
  completedRequiredLessons: z.number().int().nonnegative(),
  requiredLessons: z.number().int().nonnegative(),
  modules: z.array(
    z.object({
      module: onlineCourseModuleSchema,
      lessons: z.array(
        z.object({
          lesson: onlineLessonSchema,
          progress: onlineLessonProgressSchema.nullable(),
          locked: z.boolean(),
        }),
      ),
    }),
  ),
});
export type StudentOnlineCourseOutline = z.infer<
  typeof studentOnlineCourseOutlineSchema
>;

export const studentOnlineLessonDetailSchema = z.object({
  lesson: onlineLessonSchema,
  progress: onlineLessonProgressSchema.nullable(),
  assets: z.array(onlineLessonAssetSchema),
  locked: z.boolean(),
  previousLessonId: z.string().uuid().nullable(),
  nextLessonId: z.string().uuid().nullable(),
});
export type StudentOnlineLessonDetail = z.infer<
  typeof studentOnlineLessonDetailSchema
>;

export const onlineQuizOptionPublicSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  position: z.number().int(),
});

export const onlineQuizQuestionPublicSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string(),
  type: onlineQuizQuestionTypeSchema,
  position: z.number().int(),
  points: z.number().int(),
  options: z.array(onlineQuizOptionPublicSchema),
});

export const onlineQuizPublicSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  passScorePercent: z.number().int().min(0).max(100).nullable(),
  questions: z.array(onlineQuizQuestionPublicSchema),
});
export type OnlineQuizPublic = z.infer<typeof onlineQuizPublicSchema>;

export const onlineQuizOptionAdminSchema = onlineQuizOptionPublicSchema.extend({
  isCorrect: z.boolean(),
});

export const onlineQuizQuestionAdminSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string(),
  type: onlineQuizQuestionTypeSchema,
  position: z.number().int(),
  points: z.number().int(),
  correctText: z.string().nullable(),
  explanation: z.string().nullable(),
  options: z.array(onlineQuizOptionAdminSchema),
});

export const onlineQuizAdminSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  title: z.string(),
  passScorePercent: z.number().int().min(0).max(100).nullable(),
  isActive: z.boolean(),
  questions: z.array(onlineQuizQuestionAdminSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OnlineQuizAdmin = z.infer<typeof onlineQuizAdminSchema>;

export const upsertOnlineQuizRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  passScorePercent: z.number().int().min(0).max(100).nullable().optional(),
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(1).max(2000),
        type: onlineQuizQuestionTypeSchema,
        points: z.number().int().positive().max(100).optional(),
        correctText: z.string().trim().max(500).nullable().optional(),
        explanation: z.string().trim().max(2000).nullable().optional(),
        options: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(1000),
              isCorrect: z.boolean(),
            }),
          )
          .optional(),
      }),
    )
    .min(1)
    .max(50),
});
export type UpsertOnlineQuizRequest = z.infer<
  typeof upsertOnlineQuizRequestSchema
>;

export const submitOnlineQuizRequestSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      selectedOptionIds: z.array(z.string().uuid()).optional(),
      textAnswer: z.string().trim().max(500).optional(),
    }),
  ),
});
export type SubmitOnlineQuizRequest = z.infer<
  typeof submitOnlineQuizRequestSchema
>;

export const onlineQuizAttemptResultSchema = z.object({
  scorePercent: z.number().int().min(0).max(100),
  passed: z.boolean(),
  results: z.array(
    z.object({
      questionId: z.string().uuid(),
      correct: z.boolean(),
      explanation: z.string().nullable(),
      pointsAwarded: z.number().int(),
      pointsPossible: z.number().int(),
    }),
  ),
});
export type OnlineQuizAttemptResult = z.infer<
  typeof onlineQuizAttemptResultSchema
>;

export const createOnlineLessonSubmissionRequestSchema = z.object({
  bodyText: z.string().trim().max(10000).optional(),
});
export type CreateOnlineLessonSubmissionRequest = z.infer<
  typeof createOnlineLessonSubmissionRequestSchema
>;

export const onlineLessonSubmissionSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  studentId: z.string().uuid(),
  bodyText: z.string().nullable(),
  status: onlineSubmissionStatusSchema,
  feedback: z.string().nullable(),
  uploadStatus: z.enum(['PENDING', 'READY']).nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  originalFilename: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OnlineLessonSubmission = z.infer<
  typeof onlineLessonSubmissionSchema
>;

export function isOnlineCourseFree(
  amountMinor: string | null | bigint | null,
): boolean {
  if (amountMinor === null || amountMinor === undefined) return true;
  if (typeof amountMinor === 'bigint') return amountMinor === 0n;
  return amountMinor === '0';
}
