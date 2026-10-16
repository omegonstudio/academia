import type {
  FinanceCurrency,
  OnlineCourseAccessMode,
  OnlineCourseStatus,
  OnlineLessonAssetKind,
  OnlineLessonStatus,
  OnlineQuizQuestionType,
  OnlineSubmissionStatus,
} from '@academia/shared';
import {
  ONLINE_COURSE_ACCESS_MODES,
  ONLINE_COURSE_STATUSES,
  ONLINE_LESSON_ASSET_KINDS,
  ONLINE_LESSON_PROGRESS_STATUSES,
  ONLINE_LESSON_STATUSES,
  ONLINE_QUIZ_QUESTION_TYPES,
  ONLINE_SUBMISSION_STATUSES,
  isFinanceCurrency,
} from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import {
  parseStringListJson,
  type OnlineCourseAccessRecord,
  type OnlineCourseModuleRecord,
  type OnlineCourseRecord,
  type OnlineCourseStore,
  type OnlineLessonAssetRecord,
  type OnlineLessonOrderRef,
  type OnlineLessonProgressRecord,
  type OnlineLessonRecord,
  type OnlineLessonSubmissionRecord,
  type OnlineQuizAttemptRecord,
  type OnlineQuizOptionRecord,
  type OnlineQuizQuestionRecord,
  type OnlineQuizRecord,
} from './online-course-service.js';

type TxClient = Parameters<Parameters<Database['$transaction']>[0]>[0];
type OnlineDb = Database | TxClient;

function assertEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${label} in database: ${value}`);
  }
  return value as T;
}

type AuthorTeacher = {
  firstName: string;
  lastName: string;
} | null;

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  authorTeacherId: string | null;
  coverImageUrl: string | null;
  benefits: unknown;
  bonus: unknown;
  status: string;
  accessMode: string;
  certificateEnabled: boolean;
  amountMinor: bigint | null;
  currency: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorTeacher?: AuthorTeacher;
  _count?: { modules: number };
};

function mapCourse(
  row: CourseRow,
  lessonCount?: number,
): OnlineCourseRecord {
  let currency: FinanceCurrency | null = null;
  if (row.currency !== null) {
    if (!isFinanceCurrency(row.currency)) {
      throw new Error(`Invalid online course currency: ${row.currency}`);
    }
    currency = row.currency;
  }

  const authorName = row.authorTeacher
    ? `${row.authorTeacher.firstName} ${row.authorTeacher.lastName}`.trim()
    : null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    authorTeacherId: row.authorTeacherId,
    authorName,
    coverImageUrl: row.coverImageUrl,
    benefits: parseStringListJson(row.benefits),
    bonus: parseStringListJson(row.bonus),
    status: assertEnum(row.status, ONLINE_COURSE_STATUSES, 'online course status'),
    accessMode: assertEnum(
      row.accessMode,
      ONLINE_COURSE_ACCESS_MODES,
      'online course accessMode',
    ),
    certificateEnabled: row.certificateEnabled,
    amountMinor: row.amountMinor,
    currency,
    moduleCount: row._count?.modules,
    lessonCount,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapModule(
  row: {
    id: string;
    onlineCourseId: string;
    title: string;
    description: string | null;
    position: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count?: { lessons: number };
  },
): OnlineCourseModuleRecord {
  return {
    id: row.id,
    onlineCourseId: row.onlineCourseId,
    title: row.title,
    description: row.description,
    position: row.position,
    lessonCount: row._count?.lessons,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLesson(
  row: {
    id: string;
    moduleId: string;
    title: string;
    description: string | null;
    position: number;
    estimatedMinutes: number | null;
    isRequired: boolean;
    status: string;
    acceptsSubmission: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    assets?: Array<{ kind: string }>;
  },
): OnlineLessonRecord {
  const assetKinds = row.assets
    ? ([
        ...new Set(
          row.assets.map((a) =>
            assertEnum(a.kind, ONLINE_LESSON_ASSET_KINDS, 'asset kind'),
          ),
        ),
      ] as OnlineLessonAssetKind[])
    : undefined;

  return {
    id: row.id,
    moduleId: row.moduleId,
    title: row.title,
    description: row.description,
    position: row.position,
    estimatedMinutes: row.estimatedMinutes,
    isRequired: row.isRequired,
    status: assertEnum(row.status, ONLINE_LESSON_STATUSES, 'lesson status'),
    acceptsSubmission: row.acceptsSubmission,
    assetKinds,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAsset(row: {
  id: string;
  lessonId: string;
  kind: string;
  title: string;
  position: number;
  bodyText: string | null;
  externalUrl: string | null;
  uploadStatus: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  originalFilename: string | null;
  createdByUserId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): OnlineLessonAssetRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    kind: assertEnum(row.kind, ONLINE_LESSON_ASSET_KINDS, 'asset kind'),
    title: row.title,
    position: row.position,
    bodyText: row.bodyText,
    externalUrl: row.externalUrl,
    uploadStatus:
      row.uploadStatus === 'PENDING' || row.uploadStatus === 'READY'
        ? row.uploadStatus
        : null,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    originalFilename: row.originalFilename,
    createdByUserId: row.createdByUserId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAccess(row: {
  id: string;
  onlineCourseId: string;
  studentId: string;
  isActive: boolean;
  grantedAt: Date;
  expiresAt: Date | null;
  grantedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OnlineCourseAccessRecord {
  return {
    id: row.id,
    onlineCourseId: row.onlineCourseId,
    studentId: row.studentId,
    isActive: row.isActive,
    grantedAt: row.grantedAt,
    expiresAt: row.expiresAt,
    grantedByUserId: row.grantedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapProgress(row: {
  id: string;
  lessonId: string;
  studentId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  scorePercent: number | null;
  createdAt: Date;
  updatedAt: Date;
}): OnlineLessonProgressRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    studentId: row.studentId,
    status: assertEnum(
      row.status,
      ONLINE_LESSON_PROGRESS_STATUSES,
      'progress status',
    ),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    scorePercent: row.scorePercent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapQuiz(row: {
  id: string;
  lessonId: string;
  title: string;
  passScorePercent: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  questions: Array<{
    id: string;
    quizId: string;
    prompt: string;
    type: string;
    position: number;
    points: number;
    correctText: string | null;
    explanation: string | null;
    createdAt: Date;
    updatedAt: Date;
    options: Array<{
      id: string;
      questionId: string;
      label: string;
      position: number;
      isCorrect: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
}): OnlineQuizRecord {
  const questions: OnlineQuizQuestionRecord[] = row.questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q) => {
      const options: OnlineQuizOptionRecord[] = q.options
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((o) => ({
          id: o.id,
          questionId: o.questionId,
          label: o.label,
          position: o.position,
          isCorrect: o.isCorrect,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        }));
      return {
        id: q.id,
        quizId: q.quizId,
        prompt: q.prompt,
        type: assertEnum(
          q.type,
          ONLINE_QUIZ_QUESTION_TYPES,
          'quiz question type',
        ) as OnlineQuizQuestionType,
        position: q.position,
        points: q.points,
        correctText: q.correctText,
        explanation: q.explanation,
        options,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      };
    });

  return {
    id: row.id,
    lessonId: row.lessonId,
    title: row.title,
    passScorePercent: row.passScorePercent,
    isActive: row.isActive,
    questions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAttempt(row: {
  id: string;
  quizId: string;
  studentId: string;
  scorePercent: number;
  passed: boolean;
  answersJson: unknown;
  createdAt: Date;
}): OnlineQuizAttemptRecord {
  return {
    id: row.id,
    quizId: row.quizId,
    studentId: row.studentId,
    scorePercent: row.scorePercent,
    passed: row.passed,
    answersJson: row.answersJson,
    createdAt: row.createdAt,
  };
}

function mapSubmission(row: {
  id: string;
  lessonId: string;
  studentId: string;
  bodyText: string | null;
  status: string;
  feedback: string | null;
  uploadStatus: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  originalFilename: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OnlineLessonSubmissionRecord {
  return {
    id: row.id,
    lessonId: row.lessonId,
    studentId: row.studentId,
    bodyText: row.bodyText,
    status: assertEnum(
      row.status,
      ONLINE_SUBMISSION_STATUSES,
      'submission status',
    ) as OnlineSubmissionStatus,
    feedback: row.feedback,
    uploadStatus:
      row.uploadStatus === 'PENDING' || row.uploadStatus === 'READY'
        ? row.uploadStatus
        : null,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    originalFilename: row.originalFilename,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const authorTeacherSelect = {
  firstName: true,
  lastName: true,
} as const;

const courseCountSelect = {
  modules: { where: { isActive: true } },
} as const;

const quizInclude = {
  questions: {
    include: { options: true },
    orderBy: { position: 'asc' as const },
  },
} as const;

async function countActiveLessons(
  db: OnlineDb,
  onlineCourseId: string,
): Promise<number> {
  return db.onlineLesson.count({
    where: {
      isActive: true,
      module: { onlineCourseId, isActive: true },
    },
  });
}

async function hydrateCourse(
  db: OnlineDb,
  row: CourseRow,
): Promise<OnlineCourseRecord> {
  const lessonCount = await countActiveLessons(db, row.id);
  return mapCourse(row, lessonCount);
}

export function createOnlineCourseStore(database: Database): OnlineCourseStore {
  return {
    async list(options) {
      const includeInactive = options?.includeInactive === true;
      const rows = await database.onlineCourse.findMany({
        where: includeInactive ? undefined : { isActive: true },
        include: {
          authorTeacher: { select: authorTeacherSelect },
          _count: { select: courseCountSelect },
        },
        orderBy: [{ title: 'asc' }],
      });
      return Promise.all(rows.map((row) => hydrateCourse(database, row)));
    },

    async listPublished() {
      const rows = await database.onlineCourse.findMany({
        where: { isActive: true, status: 'PUBLISHED' },
        include: {
          authorTeacher: { select: authorTeacherSelect },
          _count: { select: courseCountSelect },
        },
        orderBy: [{ title: 'asc' }],
      });
      return Promise.all(rows.map((row) => hydrateCourse(database, row)));
    },

    async findById(id) {
      const row = await database.onlineCourse.findUnique({
        where: { id },
        include: {
          authorTeacher: { select: authorTeacherSelect },
          _count: { select: courseCountSelect },
        },
      });
      return row ? hydrateCourse(database, row) : null;
    },

    async findBySlug(slug) {
      const row = await database.onlineCourse.findUnique({
        where: { slug },
        include: {
          authorTeacher: { select: authorTeacherSelect },
          _count: { select: courseCountSelect },
        },
      });
      return row ? hydrateCourse(database, row) : null;
    },

    async createCourse(input) {
      const row = await database.onlineCourse.create({
        data: {
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
          amountMinor: input.amountMinor,
          currency: input.currency,
        },
        include: {
          authorTeacher: { select: authorTeacherSelect },
          _count: { select: courseCountSelect },
        },
      });
      return hydrateCourse(database, row);
    },

    async updateCourse(id, patch) {
      const data: {
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
      } = {};
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.slug !== undefined) data.slug = patch.slug;
      if (patch.subtitle !== undefined) data.subtitle = patch.subtitle;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.authorTeacherId !== undefined) {
        data.authorTeacherId = patch.authorTeacherId;
      }
      if (patch.coverImageUrl !== undefined) {
        data.coverImageUrl = patch.coverImageUrl;
      }
      if (patch.benefits !== undefined) data.benefits = patch.benefits;
      if (patch.bonus !== undefined) data.bonus = patch.bonus;
      if (patch.accessMode !== undefined) data.accessMode = patch.accessMode;
      if (patch.certificateEnabled !== undefined) {
        data.certificateEnabled = patch.certificateEnabled;
      }
      if (patch.status !== undefined) data.status = patch.status;
      if (patch.amountMinor !== undefined) data.amountMinor = patch.amountMinor;
      if (patch.currency !== undefined) data.currency = patch.currency;
      if (patch.isActive !== undefined) data.isActive = patch.isActive;

      const row = await database.onlineCourse.update({
        where: { id },
        data,
        include: {
          authorTeacher: { select: authorTeacherSelect },
          _count: { select: courseCountSelect },
        },
      });
      return hydrateCourse(database, row);
    },

    async listModules(onlineCourseId, options) {
      const includeInactive = options?.includeInactive === true;
      const rows = await database.onlineCourseModule.findMany({
        where: {
          onlineCourseId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: {
          _count: {
            select: { lessons: { where: { isActive: true } } },
          },
        },
        orderBy: [{ position: 'asc' }],
      });
      return rows.map(mapModule);
    },

    async findModuleById(id) {
      const row = await database.onlineCourseModule.findUnique({
        where: { id },
        include: {
          _count: {
            select: { lessons: { where: { isActive: true } } },
          },
        },
      });
      return row ? mapModule(row) : null;
    },

    async createModule(input) {
      const row = await database.onlineCourseModule.create({
        data: {
          onlineCourseId: input.onlineCourseId,
          title: input.title,
          description: input.description,
          position: input.position,
        },
        include: {
          _count: {
            select: { lessons: { where: { isActive: true } } },
          },
        },
      });
      return mapModule(row);
    },

    async updateModule(id, patch) {
      const data: {
        title?: string;
        description?: string | null;
        isActive?: boolean;
      } = {};
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.isActive !== undefined) data.isActive = patch.isActive;

      const row = await database.onlineCourseModule.update({
        where: { id },
        data,
        include: {
          _count: {
            select: { lessons: { where: { isActive: true } } },
          },
        },
      });
      return mapModule(row);
    },

    async reorderModules(onlineCourseId, moduleIds) {
      return database.$transaction(async (tx) => {
        await Promise.all(
          moduleIds.map((id, position) =>
            tx.onlineCourseModule.update({
              where: { id },
              data: { position },
            }),
          ),
        );
        const rows = await tx.onlineCourseModule.findMany({
          where: { onlineCourseId, isActive: true },
          include: {
            _count: {
              select: { lessons: { where: { isActive: true } } },
            },
          },
          orderBy: [{ position: 'asc' }],
        });
        return rows.map(mapModule);
      });
    },

    async nextModulePosition(onlineCourseId) {
      const agg = await database.onlineCourseModule.aggregate({
        where: { onlineCourseId },
        _max: { position: true },
      });
      return (agg._max.position ?? -1) + 1;
    },

    async listLessons(moduleId, options) {
      const includeInactive = options?.includeInactive === true;
      const rows = await database.onlineLesson.findMany({
        where: {
          moduleId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: {
          assets: {
            where: { isActive: true },
            select: { kind: true },
          },
        },
        orderBy: [{ position: 'asc' }],
      });
      return rows.map(mapLesson);
    },

    async findLessonById(id) {
      const row = await database.onlineLesson.findUnique({
        where: { id },
        include: {
          assets: {
            where: { isActive: true },
            select: { kind: true },
          },
        },
      });
      return row ? mapLesson(row) : null;
    },

    async createLesson(input) {
      const row = await database.onlineLesson.create({
        data: {
          moduleId: input.moduleId,
          title: input.title,
          description: input.description,
          position: input.position,
          estimatedMinutes: input.estimatedMinutes,
          isRequired: input.isRequired,
          status: input.status,
          acceptsSubmission: input.acceptsSubmission,
        },
        include: {
          assets: {
            where: { isActive: true },
            select: { kind: true },
          },
        },
      });
      return mapLesson(row);
    },

    async updateLesson(id, patch) {
      const data: {
        title?: string;
        description?: string | null;
        estimatedMinutes?: number | null;
        isRequired?: boolean;
        status?: OnlineLessonStatus;
        acceptsSubmission?: boolean;
        isActive?: boolean;
      } = {};
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.estimatedMinutes !== undefined) {
        data.estimatedMinutes = patch.estimatedMinutes;
      }
      if (patch.isRequired !== undefined) data.isRequired = patch.isRequired;
      if (patch.status !== undefined) data.status = patch.status;
      if (patch.acceptsSubmission !== undefined) {
        data.acceptsSubmission = patch.acceptsSubmission;
      }
      if (patch.isActive !== undefined) data.isActive = patch.isActive;

      const row = await database.onlineLesson.update({
        where: { id },
        data,
        include: {
          assets: {
            where: { isActive: true },
            select: { kind: true },
          },
        },
      });
      return mapLesson(row);
    },

    async reorderLessons(moduleId, lessonIds) {
      return database.$transaction(async (tx) => {
        await Promise.all(
          lessonIds.map((id, position) =>
            tx.onlineLesson.update({
              where: { id },
              data: { position },
            }),
          ),
        );
        const rows = await tx.onlineLesson.findMany({
          where: { moduleId, isActive: true },
          include: {
            assets: {
              where: { isActive: true },
              select: { kind: true },
            },
          },
          orderBy: [{ position: 'asc' }],
        });
        return rows.map(mapLesson);
      });
    },

    async nextLessonPosition(moduleId) {
      const agg = await database.onlineLesson.aggregate({
        where: { moduleId },
        _max: { position: true },
      });
      return (agg._max.position ?? -1) + 1;
    },

    async listLessonOrderRefs(onlineCourseId) {
      const rows = await database.onlineLesson.findMany({
        where: {
          isActive: true,
          module: { onlineCourseId, isActive: true },
        },
        select: {
          id: true,
          moduleId: true,
          position: true,
          isRequired: true,
          status: true,
          isActive: true,
          module: { select: { position: true, onlineCourseId: true } },
        },
        orderBy: [
          { module: { position: 'asc' } },
          { position: 'asc' },
        ],
      });

      return rows.map(
        (row): OnlineLessonOrderRef => ({
          id: row.id,
          moduleId: row.moduleId,
          modulePosition: row.module.position,
          position: row.position,
          isRequired: row.isRequired,
          status: assertEnum(
            row.status,
            ONLINE_LESSON_STATUSES,
            'lesson status',
          ),
          isActive: row.isActive,
          onlineCourseId: row.module.onlineCourseId,
        }),
      );
    },

    async findCourseIdForLesson(lessonId) {
      const row = await database.onlineLesson.findUnique({
        where: { id: lessonId },
        select: { module: { select: { onlineCourseId: true } } },
      });
      return row?.module.onlineCourseId ?? null;
    },

    async listAssets(lessonId, options) {
      const includeInactive = options?.includeInactive === true;
      const rows = await database.onlineLessonAsset.findMany({
        where: {
          lessonId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [{ position: 'asc' }],
      });
      return rows.map(mapAsset);
    },

    async findAssetById(id) {
      const row = await database.onlineLessonAsset.findUnique({
        where: { id },
      });
      return row ? mapAsset(row) : null;
    },

    async createAsset(input) {
      const row = await database.onlineLessonAsset.create({
        data: {
          lessonId: input.lessonId,
          kind: input.kind,
          title: input.title,
          position: input.position,
          bodyText: input.bodyText,
          externalUrl: input.externalUrl,
          uploadStatus: input.uploadStatus,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          originalFilename: input.originalFilename,
          createdByUserId: input.createdByUserId,
        },
      });
      return mapAsset(row);
    },

    async updateAsset(id, patch) {
      try {
        const data: {
          title?: string;
          bodyText?: string | null;
          externalUrl?: string | null;
          isActive?: boolean;
        } = {};
        if (patch.title !== undefined) data.title = patch.title;
        if (patch.bodyText !== undefined) data.bodyText = patch.bodyText;
        if (patch.externalUrl !== undefined) {
          data.externalUrl = patch.externalUrl;
        }
        if (patch.isActive !== undefined) data.isActive = patch.isActive;

        const row = await database.onlineLessonAsset.update({
          where: { id },
          data,
        });
        return mapAsset(row);
      } catch {
        return null;
      }
    },

    async markAssetReady(id, sizeBytes) {
      try {
        const row = await database.onlineLessonAsset.update({
          where: { id },
          data: { uploadStatus: 'READY', sizeBytes },
        });
        return mapAsset(row);
      } catch {
        return null;
      }
    },

    async softDeleteAsset(id) {
      try {
        const row = await database.onlineLessonAsset.update({
          where: { id },
          data: { isActive: false },
        });
        return mapAsset(row);
      } catch {
        return null;
      }
    },

    async nextAssetPosition(lessonId) {
      const agg = await database.onlineLessonAsset.aggregate({
        where: { lessonId },
        _max: { position: true },
      });
      return (agg._max.position ?? -1) + 1;
    },

    async findAccess(onlineCourseId, studentId) {
      const row = await database.onlineCourseAccess.findUnique({
        where: {
          onlineCourseId_studentId: { onlineCourseId, studentId },
        },
      });
      return row ? mapAccess(row) : null;
    },

    async createAccess(input) {
      const row = await database.onlineCourseAccess.create({
        data: {
          onlineCourseId: input.onlineCourseId,
          studentId: input.studentId,
          grantedByUserId: input.grantedByUserId,
          expiresAt: input.expiresAt,
        },
      });
      return mapAccess(row);
    },

    async updateAccess(id, patch) {
      const data: {
        isActive?: boolean;
        grantedByUserId?: string | null;
        expiresAt?: Date | null;
        grantedAt?: Date;
      } = {};
      if (patch.isActive !== undefined) data.isActive = patch.isActive;
      if (patch.grantedByUserId !== undefined) {
        data.grantedByUserId = patch.grantedByUserId;
      }
      if (patch.expiresAt !== undefined) data.expiresAt = patch.expiresAt;
      if (patch.grantedAt !== undefined) data.grantedAt = patch.grantedAt;

      const row = await database.onlineCourseAccess.update({
        where: { id },
        data,
      });
      return mapAccess(row);
    },

    async findProgress(lessonId, studentId) {
      const row = await database.onlineLessonProgress.findUnique({
        where: { lessonId_studentId: { lessonId, studentId } },
      });
      return row ? mapProgress(row) : null;
    },

    async listProgressForStudentInCourse(studentId, onlineCourseId) {
      const rows = await database.onlineLessonProgress.findMany({
        where: {
          studentId,
          lesson: {
            module: { onlineCourseId },
          },
        },
      });
      return rows.map(mapProgress);
    },

    async upsertProgress(input) {
      const row = await database.onlineLessonProgress.upsert({
        where: {
          lessonId_studentId: {
            lessonId: input.lessonId,
            studentId: input.studentId,
          },
        },
        create: {
          lessonId: input.lessonId,
          studentId: input.studentId,
          status: input.status,
          startedAt: input.startedAt ?? null,
          completedAt: input.completedAt ?? null,
          scorePercent: input.scorePercent ?? null,
        },
        update: {
          status: input.status,
          ...(input.startedAt !== undefined
            ? { startedAt: input.startedAt }
            : {}),
          ...(input.completedAt !== undefined
            ? { completedAt: input.completedAt }
            : {}),
          ...(input.scorePercent !== undefined
            ? { scorePercent: input.scorePercent }
            : {}),
        },
      });
      return mapProgress(row);
    },

    async findQuizByLessonId(lessonId) {
      const row = await database.onlineQuiz.findUnique({
        where: { lessonId },
        include: quizInclude,
      });
      return row ? mapQuiz(row) : null;
    },

    async upsertQuiz(input) {
      return database.$transaction(async (tx) => {
        const existing = await tx.onlineQuiz.findUnique({
          where: { lessonId: input.lessonId },
          select: { id: true },
        });

        let quizId: string;
        if (existing) {
          quizId = existing.id;
          await tx.onlineQuizQuestion.deleteMany({ where: { quizId } });
          await tx.onlineQuiz.update({
            where: { id: quizId },
            data: {
              title: input.title,
              passScorePercent: input.passScorePercent,
              isActive: true,
            },
          });
        } else {
          const created = await tx.onlineQuiz.create({
            data: {
              lessonId: input.lessonId,
              title: input.title,
              passScorePercent: input.passScorePercent,
            },
          });
          quizId = created.id;
        }

        for (let qIndex = 0; qIndex < input.questions.length; qIndex++) {
          const q = input.questions[qIndex]!;
          const question = await tx.onlineQuizQuestion.create({
            data: {
              quizId,
              prompt: q.prompt,
              type: q.type,
              position: qIndex,
              points: q.points,
              correctText: q.correctText,
              explanation: q.explanation,
            },
          });
          if (q.options.length > 0) {
            await tx.onlineQuizOption.createMany({
              data: q.options.map((o, oIndex) => ({
                questionId: question.id,
                label: o.label,
                position: oIndex,
                isCorrect: o.isCorrect,
              })),
            });
          }
        }

        const full = await tx.onlineQuiz.findUniqueOrThrow({
          where: { id: quizId },
          include: quizInclude,
        });
        return mapQuiz(full);
      });
    },

    async createQuizAttempt(input) {
      const row = await database.onlineQuizAttempt.create({
        data: {
          quizId: input.quizId,
          studentId: input.studentId,
          scorePercent: input.scorePercent,
          passed: input.passed,
          answersJson: input.answersJson as object,
        },
      });
      return mapAttempt(row);
    },

    async createSubmission(input) {
      const row = await database.onlineLessonSubmission.create({
        data: {
          lessonId: input.lessonId,
          studentId: input.studentId,
          bodyText: input.bodyText,
        },
      });
      return mapSubmission(row);
    },

    async listSubmissionsByLessonAndStudent(lessonId, studentId) {
      const rows = await database.onlineLessonSubmission.findMany({
        where: { lessonId, studentId },
        orderBy: [{ createdAt: 'desc' }],
      });
      return rows.map(mapSubmission);
    },
  };
}
