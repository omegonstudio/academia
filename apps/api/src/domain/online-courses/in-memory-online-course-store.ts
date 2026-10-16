import { randomUUID } from 'node:crypto';
import type {
  OnlineLessonAssetKind,
  OnlineSubmissionStatus,
} from '@academia/shared';
import type {
  OnlineCourseAccessRecord,
  OnlineCourseModuleRecord,
  OnlineCourseRecord,
  OnlineCourseStore,
  OnlineLessonAssetRecord,
  OnlineLessonOrderRef,
  OnlineLessonProgressRecord,
  OnlineLessonRecord,
  OnlineLessonSubmissionRecord,
  OnlineQuizAttemptRecord,
  OnlineQuizOptionRecord,
  OnlineQuizQuestionInput,
  OnlineQuizQuestionRecord,
  OnlineQuizRecord,
} from './online-course-service.js';

export interface InMemoryOnlineCourseStore extends OnlineCourseStore {
  courses: Map<string, OnlineCourseRecord>;
  modules: Map<string, OnlineCourseModuleRecord>;
  lessons: Map<string, OnlineLessonRecord>;
  assets: Map<string, OnlineLessonAssetRecord>;
  accesses: Map<string, OnlineCourseAccessRecord>;
  progress: Map<string, OnlineLessonProgressRecord>;
  quizzes: Map<string, OnlineQuizRecord>;
  attempts: Map<string, OnlineQuizAttemptRecord>;
  submissions: Map<string, OnlineLessonSubmissionRecord>;
  /** Optional author display names keyed by teacher id. */
  authorNames: Map<string, string>;
  clear(): void;
  seedAuthorName(teacherId: string, name: string): void;
}

function cloneCourse(row: OnlineCourseRecord): OnlineCourseRecord {
  return {
    ...row,
    benefits: [...row.benefits],
    bonus: [...row.bonus],
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneModule(row: OnlineCourseModuleRecord): OnlineCourseModuleRecord {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneLesson(row: OnlineLessonRecord): OnlineLessonRecord {
  return {
    ...row,
    assetKinds: row.assetKinds ? [...row.assetKinds] : undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneAsset(row: OnlineLessonAssetRecord): OnlineLessonAssetRecord {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneAccess(row: OnlineCourseAccessRecord): OnlineCourseAccessRecord {
  return {
    ...row,
    grantedAt: new Date(row.grantedAt),
    expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneProgress(
  row: OnlineLessonProgressRecord,
): OnlineLessonProgressRecord {
  return {
    ...row,
    startedAt: row.startedAt ? new Date(row.startedAt) : null,
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneQuiz(row: OnlineQuizRecord): OnlineQuizRecord {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    questions: row.questions.map((q) => ({
      ...q,
      createdAt: new Date(q.createdAt),
      updatedAt: new Date(q.updatedAt),
      options: q.options.map((o) => ({
        ...o,
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt),
      })),
    })),
  };
}

function progressKey(lessonId: string, studentId: string): string {
  return `${lessonId}:${studentId}`;
}

function accessKey(onlineCourseId: string, studentId: string): string {
  return `${onlineCourseId}:${studentId}`;
}

function UniqueViolation(message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = 'P2002';
  return error;
}

export function createInMemoryOnlineCourseStore(): InMemoryOnlineCourseStore {
  const courses = new Map<string, OnlineCourseRecord>();
  const modules = new Map<string, OnlineCourseModuleRecord>();
  const lessons = new Map<string, OnlineLessonRecord>();
  const assets = new Map<string, OnlineLessonAssetRecord>();
  const accesses = new Map<string, OnlineCourseAccessRecord>();
  const progress = new Map<string, OnlineLessonProgressRecord>();
  const quizzes = new Map<string, OnlineQuizRecord>();
  const quizzesByLesson = new Map<string, string>();
  const attempts = new Map<string, OnlineQuizAttemptRecord>();
  const submissions = new Map<string, OnlineLessonSubmissionRecord>();
  const authorNames = new Map<string, string>();

  function withCounts(course: OnlineCourseRecord): OnlineCourseRecord {
    const courseModules = [...modules.values()].filter(
      (m) => m.onlineCourseId === course.id && m.isActive,
    );
    const moduleIds = new Set(courseModules.map((m) => m.id));
    const lessonCount = [...lessons.values()].filter(
      (l) => moduleIds.has(l.moduleId) && l.isActive,
    ).length;
    return {
      ...cloneCourse(course),
      authorName: course.authorTeacherId
        ? (authorNames.get(course.authorTeacherId) ?? null)
        : null,
      moduleCount: courseModules.length,
      lessonCount,
    };
  }

  function withLessonCount(
    module: OnlineCourseModuleRecord,
  ): OnlineCourseModuleRecord {
    const lessonCount = [...lessons.values()].filter(
      (l) => l.moduleId === module.id && l.isActive,
    ).length;
    return { ...cloneModule(module), lessonCount };
  }

  function withAssetKinds(lesson: OnlineLessonRecord): OnlineLessonRecord {
    const kinds = [
      ...new Set(
        [...assets.values()]
          .filter((a) => a.lessonId === lesson.id && a.isActive)
          .map((a) => a.kind),
      ),
    ] as OnlineLessonAssetKind[];
    return { ...cloneLesson(lesson), assetKinds: kinds };
  }

  const store: InMemoryOnlineCourseStore = {
    courses,
    modules,
    lessons,
    assets,
    accesses,
    progress,
    quizzes,
    attempts,
    submissions,
    authorNames,

    clear() {
      courses.clear();
      modules.clear();
      lessons.clear();
      assets.clear();
      accesses.clear();
      progress.clear();
      quizzes.clear();
      quizzesByLesson.clear();
      attempts.clear();
      submissions.clear();
      authorNames.clear();
    },

    seedAuthorName(teacherId, name) {
      authorNames.set(teacherId, name);
    },

    async list(options) {
      const includeInactive = options?.includeInactive === true;
      return [...courses.values()]
        .filter((c) => includeInactive || c.isActive)
        .map(withCounts)
        .sort((a, b) => a.title.localeCompare(b.title));
    },

    async listPublished() {
      return [...courses.values()]
        .filter((c) => c.isActive && c.status === 'PUBLISHED')
        .map(withCounts)
        .sort((a, b) => a.title.localeCompare(b.title));
    },

    async findById(id) {
      const row = courses.get(id);
      return row ? withCounts(row) : null;
    },

    async findBySlug(slug) {
      const row = [...courses.values()].find((c) => c.slug === slug);
      return row ? withCounts(row) : null;
    },

    async createCourse(input) {
      if ([...courses.values()].some((c) => c.slug === input.slug)) {
        throw UniqueViolation('slug');
      }
      const now = new Date();
      const record: OnlineCourseRecord = {
        id: randomUUID(),
        title: input.title,
        slug: input.slug,
        subtitle: input.subtitle,
        description: input.description,
        authorTeacherId: input.authorTeacherId,
        authorName: input.authorTeacherId
          ? (authorNames.get(input.authorTeacherId) ?? null)
          : null,
        coverImageUrl: input.coverImageUrl,
        benefits: [...input.benefits],
        bonus: [...input.bonus],
        status: 'DRAFT',
        accessMode: input.accessMode,
        certificateEnabled: input.certificateEnabled,
        amountMinor: input.amountMinor,
        currency: input.currency,
        moduleCount: 0,
        lessonCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      courses.set(record.id, record);
      return withCounts(record);
    },

    async updateCourse(id, patch) {
      const current = courses.get(id);
      if (!current) throw new Error('missing course');
      if (
        patch.slug !== undefined &&
        patch.slug !== current.slug &&
        [...courses.values()].some((c) => c.slug === patch.slug)
      ) {
        throw UniqueViolation('slug');
      }
      const next: OnlineCourseRecord = {
        ...current,
        title: patch.title ?? current.title,
        slug: patch.slug ?? current.slug,
        subtitle:
          patch.subtitle !== undefined ? patch.subtitle : current.subtitle,
        description:
          patch.description !== undefined
            ? patch.description
            : current.description,
        authorTeacherId:
          patch.authorTeacherId !== undefined
            ? patch.authorTeacherId
            : current.authorTeacherId,
        coverImageUrl:
          patch.coverImageUrl !== undefined
            ? patch.coverImageUrl
            : current.coverImageUrl,
        benefits:
          patch.benefits !== undefined
            ? [...patch.benefits]
            : current.benefits,
        bonus: patch.bonus !== undefined ? [...patch.bonus] : current.bonus,
        accessMode: patch.accessMode ?? current.accessMode,
        certificateEnabled:
          patch.certificateEnabled ?? current.certificateEnabled,
        status: patch.status ?? current.status,
        amountMinor:
          patch.amountMinor !== undefined
            ? patch.amountMinor
            : current.amountMinor,
        currency:
          patch.currency !== undefined ? patch.currency : current.currency,
        isActive: patch.isActive ?? current.isActive,
        authorName: null,
        updatedAt: new Date(),
      };
      next.authorName = next.authorTeacherId
        ? (authorNames.get(next.authorTeacherId) ?? null)
        : null;
      courses.set(id, next);
      return withCounts(next);
    },

    async listModules(onlineCourseId, options) {
      const includeInactive = options?.includeInactive === true;
      return [...modules.values()]
        .filter(
          (m) =>
            m.onlineCourseId === onlineCourseId &&
            (includeInactive || m.isActive),
        )
        .map(withLessonCount)
        .sort((a, b) => a.position - b.position);
    },

    async findModuleById(id) {
      const row = modules.get(id);
      return row ? withLessonCount(row) : null;
    },

    async createModule(input) {
      const now = new Date();
      const record: OnlineCourseModuleRecord = {
        id: randomUUID(),
        onlineCourseId: input.onlineCourseId,
        title: input.title,
        description: input.description,
        position: input.position,
        lessonCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      modules.set(record.id, record);
      return withLessonCount(record);
    },

    async updateModule(id, patch) {
      const current = modules.get(id);
      if (!current) throw new Error('missing module');
      const next: OnlineCourseModuleRecord = {
        ...current,
        title: patch.title ?? current.title,
        description:
          patch.description !== undefined
            ? patch.description
            : current.description,
        isActive: patch.isActive ?? current.isActive,
        updatedAt: new Date(),
      };
      modules.set(id, next);
      return withLessonCount(next);
    },

    async reorderModules(onlineCourseId, moduleIds) {
      // Transaction-like: update all positions atomically in memory.
      const now = new Date();
      moduleIds.forEach((id, index) => {
        const row = modules.get(id);
        if (!row || row.onlineCourseId !== onlineCourseId) {
          throw new Error('invalid module reorder');
        }
        modules.set(id, { ...row, position: index, updatedAt: now });
      });
      return store.listModules(onlineCourseId, { includeInactive: false });
    },

    async nextModulePosition(onlineCourseId) {
      const rows = [...modules.values()].filter(
        (m) => m.onlineCourseId === onlineCourseId,
      );
      if (rows.length === 0) return 0;
      return Math.max(...rows.map((m) => m.position)) + 1;
    },

    async listLessons(moduleId, options) {
      const includeInactive = options?.includeInactive === true;
      return [...lessons.values()]
        .filter(
          (l) => l.moduleId === moduleId && (includeInactive || l.isActive),
        )
        .map(withAssetKinds)
        .sort((a, b) => a.position - b.position);
    },

    async findLessonById(id) {
      const row = lessons.get(id);
      return row ? withAssetKinds(row) : null;
    },

    async createLesson(input) {
      const now = new Date();
      const record: OnlineLessonRecord = {
        id: randomUUID(),
        moduleId: input.moduleId,
        title: input.title,
        description: input.description,
        position: input.position,
        estimatedMinutes: input.estimatedMinutes,
        isRequired: input.isRequired,
        status: input.status,
        acceptsSubmission: input.acceptsSubmission,
        assetKinds: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      lessons.set(record.id, record);
      return withAssetKinds(record);
    },

    async updateLesson(id, patch) {
      const current = lessons.get(id);
      if (!current) throw new Error('missing lesson');
      const next: OnlineLessonRecord = {
        ...current,
        title: patch.title ?? current.title,
        description:
          patch.description !== undefined
            ? patch.description
            : current.description,
        estimatedMinutes:
          patch.estimatedMinutes !== undefined
            ? patch.estimatedMinutes
            : current.estimatedMinutes,
        isRequired: patch.isRequired ?? current.isRequired,
        status: patch.status ?? current.status,
        acceptsSubmission:
          patch.acceptsSubmission ?? current.acceptsSubmission,
        isActive: patch.isActive ?? current.isActive,
        updatedAt: new Date(),
      };
      lessons.set(id, next);
      return withAssetKinds(next);
    },

    async reorderLessons(moduleId, lessonIds) {
      const now = new Date();
      lessonIds.forEach((id, index) => {
        const row = lessons.get(id);
        if (!row || row.moduleId !== moduleId) {
          throw new Error('invalid lesson reorder');
        }
        lessons.set(id, { ...row, position: index, updatedAt: now });
      });
      return store.listLessons(moduleId, { includeInactive: false });
    },

    async nextLessonPosition(moduleId) {
      const rows = [...lessons.values()].filter((l) => l.moduleId === moduleId);
      if (rows.length === 0) return 0;
      return Math.max(...rows.map((l) => l.position)) + 1;
    },

    async listLessonOrderRefs(onlineCourseId) {
      const courseModules = [...modules.values()].filter(
        (m) => m.onlineCourseId === onlineCourseId && m.isActive,
      );
      const refs: OnlineLessonOrderRef[] = [];
      for (const mod of courseModules) {
        for (const lesson of [...lessons.values()].filter(
          (l) => l.moduleId === mod.id && l.isActive,
        )) {
          refs.push({
            id: lesson.id,
            moduleId: mod.id,
            modulePosition: mod.position,
            position: lesson.position,
            isRequired: lesson.isRequired,
            status: lesson.status,
            isActive: lesson.isActive,
            onlineCourseId,
          });
        }
      }
      return refs.sort((a, b) => {
        if (a.modulePosition !== b.modulePosition) {
          return a.modulePosition - b.modulePosition;
        }
        return a.position - b.position;
      });
    },

    async findCourseIdForLesson(lessonId) {
      const lesson = lessons.get(lessonId);
      if (!lesson) return null;
      const mod = modules.get(lesson.moduleId);
      return mod?.onlineCourseId ?? null;
    },

    async listAssets(lessonId, options) {
      const includeInactive = options?.includeInactive === true;
      return [...assets.values()]
        .filter(
          (a) => a.lessonId === lessonId && (includeInactive || a.isActive),
        )
        .map(cloneAsset)
        .sort((a, b) => a.position - b.position);
    },

    async findAssetById(id) {
      const row = assets.get(id);
      return row ? cloneAsset(row) : null;
    },

    async createAsset(input) {
      const now = new Date();
      const record: OnlineLessonAssetRecord = {
        id: randomUUID(),
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
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      assets.set(record.id, record);
      return cloneAsset(record);
    },

    async updateAsset(id, patch) {
      const current = assets.get(id);
      if (!current) return null;
      const next: OnlineLessonAssetRecord = {
        ...current,
        title: patch.title ?? current.title,
        bodyText:
          patch.bodyText !== undefined ? patch.bodyText : current.bodyText,
        externalUrl:
          patch.externalUrl !== undefined
            ? patch.externalUrl
            : current.externalUrl,
        isActive: patch.isActive ?? current.isActive,
        updatedAt: new Date(),
      };
      assets.set(id, next);
      return cloneAsset(next);
    },

    async markAssetReady(id, sizeBytes) {
      const current = assets.get(id);
      if (!current) return null;
      const next: OnlineLessonAssetRecord = {
        ...current,
        uploadStatus: 'READY',
        sizeBytes,
        updatedAt: new Date(),
      };
      assets.set(id, next);
      return cloneAsset(next);
    },

    async softDeleteAsset(id) {
      return store.updateAsset(id, { isActive: false });
    },

    async nextAssetPosition(lessonId) {
      const rows = [...assets.values()].filter((a) => a.lessonId === lessonId);
      if (rows.length === 0) return 0;
      return Math.max(...rows.map((a) => a.position)) + 1;
    },

    async findAccess(onlineCourseId, studentId) {
      const row = accesses.get(accessKey(onlineCourseId, studentId));
      return row ? cloneAccess(row) : null;
    },

    async createAccess(input) {
      const key = accessKey(input.onlineCourseId, input.studentId);
      if (accesses.has(key)) {
        throw UniqueViolation('onlineCourseId_studentId');
      }
      const now = new Date();
      const record: OnlineCourseAccessRecord = {
        id: randomUUID(),
        onlineCourseId: input.onlineCourseId,
        studentId: input.studentId,
        isActive: true,
        grantedAt: now,
        expiresAt: input.expiresAt,
        grantedByUserId: input.grantedByUserId,
        createdAt: now,
        updatedAt: now,
      };
      accesses.set(key, record);
      return cloneAccess(record);
    },

    async updateAccess(id, patch) {
      const current = [...accesses.values()].find((a) => a.id === id);
      if (!current) throw new Error('missing access');
      const next: OnlineCourseAccessRecord = {
        ...current,
        isActive: patch.isActive ?? current.isActive,
        grantedByUserId:
          patch.grantedByUserId !== undefined
            ? patch.grantedByUserId
            : current.grantedByUserId,
        expiresAt:
          patch.expiresAt !== undefined ? patch.expiresAt : current.expiresAt,
        grantedAt:
          patch.grantedAt !== undefined ? patch.grantedAt : current.grantedAt,
        updatedAt: new Date(),
      };
      accesses.set(accessKey(next.onlineCourseId, next.studentId), next);
      return cloneAccess(next);
    },

    async findProgress(lessonId, studentId) {
      const row = progress.get(progressKey(lessonId, studentId));
      return row ? cloneProgress(row) : null;
    },

    async listProgressForStudentInCourse(studentId, onlineCourseId) {
      const lessonIds = new Set(
        (await store.listLessonOrderRefs(onlineCourseId)).map((r) => r.id),
      );
      return [...progress.values()]
        .filter((p) => p.studentId === studentId && lessonIds.has(p.lessonId))
        .map(cloneProgress);
    },

    async upsertProgress(input) {
      const key = progressKey(input.lessonId, input.studentId);
      const existing = progress.get(key);
      const now = new Date();
      const record: OnlineLessonProgressRecord = {
        id: existing?.id ?? randomUUID(),
        lessonId: input.lessonId,
        studentId: input.studentId,
        status: input.status,
        startedAt:
          input.startedAt !== undefined
            ? input.startedAt
            : (existing?.startedAt ?? null),
        completedAt:
          input.completedAt !== undefined
            ? input.completedAt
            : (existing?.completedAt ?? null),
        scorePercent:
          input.scorePercent !== undefined
            ? input.scorePercent
            : (existing?.scorePercent ?? null),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      progress.set(key, record);
      return cloneProgress(record);
    },

    async findQuizByLessonId(lessonId) {
      const quizId = quizzesByLesson.get(lessonId);
      if (!quizId) return null;
      const row = quizzes.get(quizId);
      return row ? cloneQuiz(row) : null;
    },

    async upsertQuiz(input) {
      const existingId = quizzesByLesson.get(input.lessonId);
      const now = new Date();
      const quizId = existingId ?? randomUUID();
      const questions: OnlineQuizQuestionRecord[] = input.questions.map(
        (q: OnlineQuizQuestionInput, qIndex) => {
          const questionId = randomUUID();
          const options: OnlineQuizOptionRecord[] = q.options.map(
            (o, oIndex) => ({
              id: randomUUID(),
              questionId,
              label: o.label,
              position: oIndex,
              isCorrect: o.isCorrect,
              createdAt: now,
              updatedAt: now,
            }),
          );
          return {
            id: questionId,
            quizId,
            prompt: q.prompt,
            type: q.type,
            position: qIndex,
            points: q.points,
            correctText: q.correctText,
            explanation: q.explanation,
            options,
            createdAt: now,
            updatedAt: now,
          };
        },
      );

      const record: OnlineQuizRecord = {
        id: quizId,
        lessonId: input.lessonId,
        title: input.title,
        passScorePercent: input.passScorePercent,
        isActive: true,
        questions,
        createdAt: existingId
          ? (quizzes.get(existingId)?.createdAt ?? now)
          : now,
        updatedAt: now,
      };
      quizzes.set(quizId, record);
      quizzesByLesson.set(input.lessonId, quizId);
      return cloneQuiz(record);
    },

    async createQuizAttempt(input) {
      const now = new Date();
      const record: OnlineQuizAttemptRecord = {
        id: randomUUID(),
        quizId: input.quizId,
        studentId: input.studentId,
        scorePercent: input.scorePercent,
        passed: input.passed,
        answersJson: input.answersJson,
        createdAt: now,
      };
      attempts.set(record.id, record);
      return { ...record, createdAt: new Date(record.createdAt) };
    },

    async createSubmission(input) {
      const now = new Date();
      const record: OnlineLessonSubmissionRecord = {
        id: randomUUID(),
        lessonId: input.lessonId,
        studentId: input.studentId,
        bodyText: input.bodyText,
        status: 'SUBMITTED' satisfies OnlineSubmissionStatus,
        feedback: null,
        uploadStatus: null,
        mimeType: null,
        sizeBytes: null,
        storageKey: null,
        originalFilename: null,
        createdAt: now,
        updatedAt: now,
      };
      submissions.set(record.id, record);
      return {
        ...record,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      };
    },

    async listSubmissionsByLessonAndStudent(lessonId, studentId) {
      return [...submissions.values()]
        .filter((s) => s.lessonId === lessonId && s.studentId === studentId)
        .map((s) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };

  return store;
}
