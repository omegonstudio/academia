import {
  createOnlineCourseModuleRequestSchema,
  createOnlineCourseRequestSchema,
  createOnlineLessonAssetRequestSchema,
  createOnlineLessonAssetUploadRequestSchema,
  createOnlineLessonRequestSchema,
  grantOnlineCourseAccessRequestSchema,
  reorderOnlineCourseModulesRequestSchema,
  reorderOnlineLessonsRequestSchema,
  updateOnlineCourseModuleRequestSchema,
  updateOnlineCourseRequestSchema,
  updateOnlineLessonAssetRequestSchema,
  updateOnlineLessonRequestSchema,
  upsertOnlineQuizRequestSchema,
  type OnlineCourseAccess,
  type OnlineCourseListResponse,
  type OnlineCourseModule,
  type OnlineCourseResponse,
  type OnlineLesson,
  type OnlineLessonAsset,
  type OnlineLessonAssetDownloadResponse,
  type OnlineLessonAssetUploadResponse,
  type OnlineQuizAdmin,
  type StudentOnlineCourseOutline,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import {
  grantAccess,
  revokeAccess,
} from '../../domain/online-courses/online-access-service.js';
import {
  OnlineCourseConflictError,
  OnlineCourseForbiddenError,
  OnlineCourseNotFoundError,
  OnlineCourseValidationError,
  archiveOnlineCourse,
  completeOnlineLessonAssetUpload,
  createOnlineCourse,
  createOnlineCourseModule,
  createOnlineLesson,
  createOnlineLessonAsset,
  createOnlineLessonAssetUpload,
  downloadOnlineLessonAsset,
  getOnlineCourse,
  listOnlineCourseModules,
  listOnlineCourses,
  listOnlineLessonAssets,
  listOnlineLessons,
  publishOnlineCourse,
  reorderOnlineCourseModules,
  reorderOnlineLessons,
  softDeleteOnlineCourse,
  softDeleteOnlineLessonAsset,
  toOnlineCourseModuleDto,
  toOnlineLessonDto,
  updateOnlineCourse,
  updateOnlineCourseModule,
  updateOnlineLesson,
  updateOnlineLessonAsset,
  type OnlineCourseStore,
  type OnlineLessonAssetSizeLimits,
  type OnlineLessonAssetUrlTtls,
} from '../../domain/online-courses/online-course-service.js';
import {
  calculateProgressPercent,
  isLessonLockedInCourse,
} from '../../domain/online-courses/online-progress-service.js';
import {
  getQuizAdmin,
  upsertQuiz,
} from '../../domain/online-courses/online-quiz-service.js';
import type { ObjectStoragePort } from '../../storage/object-storage.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface OnlineCoursesDependencies {
  authenticate: AuthenticateOptions;
  onlineCourses: OnlineCourseStore;
  permissionGrants: PermissionGrantStore;
  storage: ObjectStoragePort;
  sizeLimits: OnlineLessonAssetSizeLimits;
  urlTtls: OnlineLessonAssetUrlTtls;
  logError?: (payload: Record<string, unknown>, message: string) => void;
}

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

function mapDomainError(error: unknown): never {
  if (error instanceof OnlineCourseForbiddenError) {
    throw new ForbiddenError(error.message);
  }
  if (error instanceof OnlineCourseNotFoundError) {
    throw new NotFoundError(error.message);
  }
  if (error instanceof OnlineCourseValidationError) {
    throw new BadRequestError(error.message);
  }
  if (error instanceof OnlineCourseConflictError) {
    throw new ConflictError(error.message);
  }
  throw error;
}

async function requireModuleInCourse(
  store: OnlineCourseStore,
  courseId: string,
  moduleId: string,
) {
  const mod = await store.findModuleById(moduleId);
  if (!mod || !mod.isActive || mod.onlineCourseId !== courseId) {
    throw new OnlineCourseNotFoundError('Module not found.');
  }
  return mod;
}

async function requireLessonInModule(
  store: OnlineCourseStore,
  moduleId: string,
  lessonId: string,
) {
  const lesson = await store.findLessonById(lessonId);
  if (!lesson || !lesson.isActive || lesson.moduleId !== moduleId) {
    throw new OnlineCourseNotFoundError('Lesson not found.');
  }
  return lesson;
}

async function buildAdminPreviewOutline(
  store: OnlineCourseStore,
  courseId: string,
): Promise<StudentOnlineCourseOutline> {
  const course = await getOnlineCourse(store, courseId);
  const ordered = await store.listLessonOrderRefs(courseId);
  const emptyProgress = new Map();
  const progressStats = calculateProgressPercent(ordered, emptyProgress);
  const modules = await store.listModules(courseId, { includeInactive: false });

  const moduleBlocks: StudentOnlineCourseOutline['modules'] = [];
  for (const mod of modules) {
    const lessons = await store.listLessons(mod.id, { includeInactive: false });
    moduleBlocks.push({
      module: toOnlineCourseModuleDto(mod),
      lessons: lessons.map((lesson) => ({
        lesson: toOnlineLessonDto(lesson),
        progress: null,
        locked: isLessonLockedInCourse(
          course.accessMode,
          lesson.id,
          ordered,
          emptyProgress,
        ),
      })),
    });
  }

  return {
    course,
    progressPercent: progressStats.progressPercent,
    completedRequiredLessons: progressStats.completedRequiredLessons,
    requiredLessons: progressStats.requiredLessons,
    modules: moduleBlocks,
  };
}

export function createOnlineCoursesRouter({
  authenticate: authOptions,
  onlineCourses,
  permissionGrants,
  storage,
  sizeLimits,
  urlTtls,
  logError = () => undefined,
}: OnlineCoursesDependencies): Router {
  const router = Router();
  const grants = permissionGrants;

  // —— Lesson assets (static prefix before :id) ——

  router.get(
    '/online-courses/lessons/:lessonId/assets',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const lessonId = pathId(req.params['lessonId']);
          if (!lessonId) throw new BadRequestError('Lesson id is required.');
          const assets = await listOnlineLessonAssets(onlineCourses, lessonId, {
            includeInactive: true,
          });
          res.status(200).json({ assets });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/lessons/:lessonId/assets',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const lessonId = pathId(req.params['lessonId']);
          if (!lessonId) throw new BadRequestError('Lesson id is required.');
          const parsed = createOnlineLessonAssetRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Invalid lesson asset payload.');
          }
          const asset = await createOnlineLessonAsset(
            onlineCourses,
            lessonId,
            req.user!.id,
            parsed.data,
          );
          res.status(201).json({ asset } satisfies { asset: OnlineLessonAsset });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/lessons/:lessonId/assets/uploads',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const lessonId = pathId(req.params['lessonId']);
          if (!lessonId) throw new BadRequestError('Lesson id is required.');
          const parsed =
            createOnlineLessonAssetUploadRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Invalid upload intent payload.');
          }
          const body: OnlineLessonAssetUploadResponse =
            await createOnlineLessonAssetUpload(
              onlineCourses,
              storage,
              lessonId,
              req.user!.id,
              parsed.data,
              sizeLimits,
              urlTtls,
            );
          res.status(201).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.put(
    '/online-courses/lessons/:lessonId/quiz',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const lessonId = pathId(req.params['lessonId']);
          if (!lessonId) throw new BadRequestError('Lesson id is required.');
          const parsed = upsertOnlineQuizRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Invalid quiz payload.');
          }
          const quiz = await upsertQuiz(onlineCourses, lessonId, parsed.data);
          res.status(200).json({ quiz } satisfies { quiz: OnlineQuizAdmin });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/online-courses/lessons/:lessonId/quiz',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const lessonId = pathId(req.params['lessonId']);
          if (!lessonId) throw new BadRequestError('Lesson id is required.');
          const quiz = await getQuizAdmin(onlineCourses, lessonId);
          res.status(200).json({ quiz } satisfies { quiz: OnlineQuizAdmin });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/assets/:assetId/complete',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const assetId = pathId(req.params['assetId']);
          if (!assetId) throw new BadRequestError('Asset id is required.');
          const asset = await completeOnlineLessonAssetUpload(
            onlineCourses,
            storage,
            assetId,
            sizeLimits,
          );
          res.status(200).json({ asset } satisfies { asset: OnlineLessonAsset });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.patch(
    '/online-courses/assets/:assetId',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const assetId = pathId(req.params['assetId']);
          if (!assetId) throw new BadRequestError('Asset id is required.');
          const parsed = updateOnlineLessonAssetRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Invalid asset update payload.');
          }
          const asset = await updateOnlineLessonAsset(
            onlineCourses,
            assetId,
            parsed.data,
          );
          res.status(200).json({ asset } satisfies { asset: OnlineLessonAsset });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.delete(
    '/online-courses/assets/:assetId',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const assetId = pathId(req.params['assetId']);
          if (!assetId) throw new BadRequestError('Asset id is required.');
          await softDeleteOnlineLessonAsset(
            onlineCourses,
            storage,
            assetId,
            logError,
          );
          res.status(204).send();
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/online-courses/assets/:assetId/download',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const assetId = pathId(req.params['assetId']);
          if (!assetId) throw new BadRequestError('Asset id is required.');
          const body: OnlineLessonAssetDownloadResponse =
            await downloadOnlineLessonAsset(
              onlineCourses,
              storage,
              assetId,
              urlTtls,
            );
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  // —— Courses ——

  router.get(
    '/online-courses',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'read'),
    (_req, res, next) => {
      void (async () => {
        try {
          const body: OnlineCourseListResponse = {
            courses: await listOnlineCourses(onlineCourses, {
              includeInactive: true,
            }),
          };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createOnlineCourseRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid title and slug are required for an online course.',
            );
          }
          const course = await createOnlineCourse(onlineCourses, parsed.data);
          const body: OnlineCourseResponse = { course };
          res.status(201).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/online-courses/:id/preview',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const outline = await buildAdminPreviewOutline(onlineCourses, id);
          res.status(200).json(outline);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/online-courses/:id/modules',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const modules = await listOnlineCourseModules(onlineCourses, id, {
            includeInactive: true,
          });
          res.status(200).json({ modules });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/:id/modules',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const parsed = createOnlineCourseModuleRequestSchema.safeParse(
            req.body,
          );
          if (!parsed.success) {
            throw new BadRequestError('Invalid module payload.');
          }
          const mod = await createOnlineCourseModule(
            onlineCourses,
            id,
            parsed.data,
          );
          res
            .status(201)
            .json({ module: mod } satisfies { module: OnlineCourseModule });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/:id/modules/reorder',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const parsed = reorderOnlineCourseModulesRequestSchema.safeParse(
            req.body,
          );
          if (!parsed.success) {
            throw new BadRequestError('moduleIds permutation is required.');
          }
          const modules = await reorderOnlineCourseModules(
            onlineCourses,
            id,
            parsed.data.moduleIds,
          );
          res.status(200).json({ modules });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.patch(
    '/online-courses/:courseId/modules/:moduleId',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const courseId = pathId(req.params['courseId']);
          const moduleId = pathId(req.params['moduleId']);
          if (!courseId || !moduleId) {
            throw new BadRequestError('Course id and module id are required.');
          }
          await requireModuleInCourse(onlineCourses, courseId, moduleId);
          const parsed = updateOnlineCourseModuleRequestSchema.safeParse(
            req.body,
          );
          if (!parsed.success) {
            throw new BadRequestError('Invalid module update payload.');
          }
          const mod = await updateOnlineCourseModule(
            onlineCourses,
            moduleId,
            parsed.data,
          );
          res
            .status(200)
            .json({ module: mod } satisfies { module: OnlineCourseModule });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/online-courses/:courseId/modules/:moduleId/lessons',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const courseId = pathId(req.params['courseId']);
          const moduleId = pathId(req.params['moduleId']);
          if (!courseId || !moduleId) {
            throw new BadRequestError('Course id and module id are required.');
          }
          await requireModuleInCourse(onlineCourses, courseId, moduleId);
          const lessons = await listOnlineLessons(onlineCourses, moduleId, {
            includeInactive: true,
          });
          res.status(200).json({ lessons });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/:courseId/modules/:moduleId/lessons',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const courseId = pathId(req.params['courseId']);
          const moduleId = pathId(req.params['moduleId']);
          if (!courseId || !moduleId) {
            throw new BadRequestError('Course id and module id are required.');
          }
          await requireModuleInCourse(onlineCourses, courseId, moduleId);
          const parsed = createOnlineLessonRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Invalid lesson payload.');
          }
          const lesson = await createOnlineLesson(
            onlineCourses,
            moduleId,
            parsed.data,
          );
          res
            .status(201)
            .json({ lesson } satisfies { lesson: OnlineLesson });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/:courseId/modules/:moduleId/lessons/reorder',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const courseId = pathId(req.params['courseId']);
          const moduleId = pathId(req.params['moduleId']);
          if (!courseId || !moduleId) {
            throw new BadRequestError('Course id and module id are required.');
          }
          await requireModuleInCourse(onlineCourses, courseId, moduleId);
          const parsed = reorderOnlineLessonsRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('lessonIds permutation is required.');
          }
          const lessons = await reorderOnlineLessons(
            onlineCourses,
            moduleId,
            parsed.data.lessonIds,
          );
          res.status(200).json({ lessons });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.patch(
    '/online-courses/:courseId/modules/:moduleId/lessons/:lessonId',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const courseId = pathId(req.params['courseId']);
          const moduleId = pathId(req.params['moduleId']);
          const lessonId = pathId(req.params['lessonId']);
          if (!courseId || !moduleId || !lessonId) {
            throw new BadRequestError(
              'Course id, module id and lesson id are required.',
            );
          }
          await requireModuleInCourse(onlineCourses, courseId, moduleId);
          await requireLessonInModule(onlineCourses, moduleId, lessonId);
          const parsed = updateOnlineLessonRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Invalid lesson update payload.');
          }
          const lesson = await updateOnlineLesson(
            onlineCourses,
            lessonId,
            parsed.data,
          );
          res
            .status(200)
            .json({ lesson } satisfies { lesson: OnlineLesson });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/:id/publish',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const course = await publishOnlineCourse(onlineCourses, id);
          const body: OnlineCourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/:id/unpublish',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const course = await updateOnlineCourse(onlineCourses, id, {
            status: 'DRAFT',
          });
          const body: OnlineCourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/:id/archive',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const course = await archiveOnlineCourse(onlineCourses, id);
          const body: OnlineCourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/online-courses/:id/access',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const parsed = grantOnlineCourseAccessRequestSchema.safeParse(
            req.body,
          );
          if (!parsed.success) {
            throw new BadRequestError('studentId is required.');
          }
          const expiresAt =
            parsed.data.expiresAt === undefined
              ? undefined
              : parsed.data.expiresAt === null
                ? null
                : new Date(parsed.data.expiresAt);
          const access = await grantAccess(onlineCourses, {
            onlineCourseId: id,
            studentId: parsed.data.studentId,
            grantedByUserId: req.user!.id,
            expiresAt,
          });
          res
            .status(201)
            .json({ access } satisfies { access: OnlineCourseAccess });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.delete(
    '/online-courses/:id/access/:studentId',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          const studentId = pathId(req.params['studentId']);
          if (!id || !studentId) {
            throw new BadRequestError('Course id and student id are required.');
          }
          const access = await revokeAccess(onlineCourses, id, studentId);
          res
            .status(200)
            .json({ access } satisfies { access: OnlineCourseAccess });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/online-courses/:id',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const course = await getOnlineCourse(onlineCourses, id);
          const body: OnlineCourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.patch(
    '/online-courses/:id',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const parsed = updateOnlineCourseRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Provide at least one online course field to update.',
            );
          }
          const course = await updateOnlineCourse(
            onlineCourses,
            id,
            parsed.data,
          );
          const body: OnlineCourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.delete(
    '/online-courses/:id',
    authenticate(authOptions),
    requirePermission(grants, 'online_courses', 'delete'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const course = await softDeleteOnlineCourse(onlineCourses, id);
          const body: OnlineCourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  return router;
}
