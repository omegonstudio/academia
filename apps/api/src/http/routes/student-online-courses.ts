import {
  createOnlineLessonSubmissionRequestSchema,
  submitOnlineQuizRequestSchema,
  updateOnlineLessonProgressRequestSchema,
  type OnlineCourse,
  type OnlineCourseListResponse,
  type OnlineLessonAssetDownloadResponse,
  type OnlineLessonProgress,
  type OnlineLessonSubmission,
  type OnlineQuizAttemptResult,
  type OnlineQuizPublic,
  type StudentOnlineCourseOutline,
  type StudentOnlineLessonDetail,
} from '@academia/shared';
import { Router } from 'express';
import {
  enrollFree,
  hasActiveAccess,
} from '../../domain/online-courses/online-access-service.js';
import {
  OnlineCourseConflictError,
  OnlineCourseForbiddenError,
  OnlineCourseNotFoundError,
  OnlineCourseValidationError,
  downloadOnlineLessonAsset,
  getOnlineCourseBySlug,
  listOnlineLessonAssets,
  toOnlineCourseDto,
  toOnlineCourseModuleDto,
  toOnlineLessonDto,
  toOnlineLessonProgressDto,
  type OnlineCourseStore,
  type OnlineLessonAssetUrlTtls,
} from '../../domain/online-courses/online-course-service.js';
import {
  calculateProgressPercent,
  completeLesson,
  getProgressMapForCourse,
  isLessonLockedInCourse,
  startLesson,
} from '../../domain/online-courses/online-progress-service.js';
import {
  getQuizPublic,
  submitQuiz,
} from '../../domain/online-courses/online-quiz-service.js';
import {
  createSubmission,
  listOwnSubmissions,
} from '../../domain/online-courses/online-submission-service.js';
import type { StudentStore } from '../../domain/students/student-service.js';
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

export interface StudentOnlineCoursesDependencies {
  authenticate: AuthenticateOptions;
  onlineCourses: OnlineCourseStore;
  students: StudentStore;
  storage: ObjectStoragePort;
  urlTtls: OnlineLessonAssetUrlTtls;
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

async function requireStudentId(
  students: StudentStore,
  userId: string,
  role: string,
): Promise<string> {
  if (role !== 'STUDENT') {
    throw new ForbiddenError('Only students can access this resource.');
  }
  const record = await students.findByUserId(userId);
  if (!record) {
    throw new NotFoundError('Student profile not found.');
  }
  return record.id;
}

async function requirePublishedCourseBySlug(
  store: OnlineCourseStore,
  slug: string,
): Promise<OnlineCourse> {
  const course = await getOnlineCourseBySlug(store, slug);
  if (!course.isActive || course.status !== 'PUBLISHED') {
    throw new OnlineCourseNotFoundError();
  }
  return course;
}

async function requireStudentAccess(
  store: OnlineCourseStore,
  studentId: string,
  onlineCourseId: string,
): Promise<void> {
  const allowed = await hasActiveAccess(store, studentId, onlineCourseId);
  if (!allowed) {
    throw new OnlineCourseForbiddenError(
      'You do not have access to this online course.',
    );
  }
}

async function buildStudentOutline(
  store: OnlineCourseStore,
  course: OnlineCourse,
  studentId: string,
): Promise<StudentOnlineCourseOutline> {
  const ordered = await store.listLessonOrderRefs(course.id);
  const progressByLessonId = await getProgressMapForCourse(
    store,
    studentId,
    course.id,
  );
  const progressStats = calculateProgressPercent(ordered, progressByLessonId);
  const modules = await store.listModules(course.id, {
    includeInactive: false,
  });

  const moduleBlocks: StudentOnlineCourseOutline['modules'] = [];
  for (const mod of modules) {
    const lessons = await store.listLessons(mod.id, {
      includeInactive: false,
    });
    const visible = lessons.filter((l) => l.status === 'PUBLISHED');
    moduleBlocks.push({
      module: toOnlineCourseModuleDto(mod),
      lessons: visible.map((lesson) => {
        const progressRow = progressByLessonId.get(lesson.id);
        return {
          lesson: toOnlineLessonDto(lesson),
          progress: progressRow
            ? toOnlineLessonProgressDto(progressRow)
            : null,
          locked: isLessonLockedInCourse(
            course.accessMode,
            lesson.id,
            ordered,
            progressByLessonId,
          ),
        };
      }),
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

async function resolveLessonNeighbors(
  orderedLessonIds: string[],
  lessonId: string,
): Promise<{ previousLessonId: string | null; nextLessonId: string | null }> {
  const index = orderedLessonIds.indexOf(lessonId);
  if (index < 0) {
    return { previousLessonId: null, nextLessonId: null };
  }
  return {
    previousLessonId: index > 0 ? orderedLessonIds[index - 1]! : null,
    nextLessonId:
      index < orderedLessonIds.length - 1
        ? orderedLessonIds[index + 1]!
        : null,
  };
}

/**
 * Student self-scoped online-course routes.
 * Identity comes from the session — never from a client-supplied studentId.
 */
export function createStudentOnlineCoursesRouter({
  authenticate: authOptions,
  onlineCourses,
  students,
  storage,
  urlTtls,
}: StudentOnlineCoursesDependencies): Router {
  const router = Router();

  router.get(
    '/students/me/online-courses/assets/:assetId/download',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const assetId = pathId(req.params['assetId']);
          if (!assetId) throw new BadRequestError('Asset id is required.');

          const asset = await onlineCourses.findAssetById(assetId);
          if (!asset || !asset.isActive) {
            throw new OnlineCourseNotFoundError('Asset not found.');
          }
          const courseId = await onlineCourses.findCourseIdForLesson(
            asset.lessonId,
          );
          if (!courseId) {
            throw new OnlineCourseNotFoundError('Asset not found.');
          }
          await requireStudentAccess(onlineCourses, studentId, courseId);

          const ordered = await onlineCourses.listLessonOrderRefs(courseId);
          const course = await onlineCourses.findById(courseId);
          if (!course) throw new OnlineCourseNotFoundError();
          const progressByLessonId = await getProgressMapForCourse(
            onlineCourses,
            studentId,
            courseId,
          );
          if (
            isLessonLockedInCourse(
              course.accessMode,
              asset.lessonId,
              ordered,
              progressByLessonId,
            )
          ) {
            throw new OnlineCourseForbiddenError(
              'Complete previous required lessons before continuing.',
            );
          }

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

  router.get(
    '/students/me/online-courses',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const published = await onlineCourses.listPublished();
          const courses: OnlineCourse[] = [];
          for (const row of published) {
            if (await hasActiveAccess(onlineCourses, studentId, row.id)) {
              courses.push(toOnlineCourseDto(row));
            }
          }
          const body: OnlineCourseListResponse = { courses };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/students/me/online-courses/:slug',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const slug = pathId(req.params['slug']);
          if (!slug) throw new BadRequestError('Slug is required.');
          const course = await requirePublishedCourseBySlug(
            onlineCourses,
            slug,
          );
          await requireStudentAccess(onlineCourses, studentId, course.id);
          const outline = await buildStudentOutline(
            onlineCourses,
            course,
            studentId,
          );
          res.status(200).json(outline);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/students/me/online-courses/:slug/enroll-free',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const slug = pathId(req.params['slug']);
          if (!slug) throw new BadRequestError('Slug is required.');
          const course = await requirePublishedCourseBySlug(
            onlineCourses,
            slug,
          );
          const access = await enrollFree(
            onlineCourses,
            studentId,
            course.id,
          );
          res.status(201).json({ access });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/students/me/online-courses/:slug/lessons/:lessonId',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const slug = pathId(req.params['slug']);
          const lessonId = pathId(req.params['lessonId']);
          if (!slug || !lessonId) {
            throw new BadRequestError('Slug and lesson id are required.');
          }
          const course = await requirePublishedCourseBySlug(
            onlineCourses,
            slug,
          );
          await requireStudentAccess(onlineCourses, studentId, course.id);

          const lesson = await onlineCourses.findLessonById(lessonId);
          if (!lesson || !lesson.isActive || lesson.status !== 'PUBLISHED') {
            throw new OnlineCourseNotFoundError('Lesson not found.');
          }
          const courseIdForLesson =
            await onlineCourses.findCourseIdForLesson(lessonId);
          if (courseIdForLesson !== course.id) {
            throw new OnlineCourseNotFoundError('Lesson not found.');
          }

          const ordered = await onlineCourses.listLessonOrderRefs(course.id);
          const progressByLessonId = await getProgressMapForCourse(
            onlineCourses,
            studentId,
            course.id,
          );
          const locked = isLessonLockedInCourse(
            course.accessMode,
            lessonId,
            ordered,
            progressByLessonId,
          );
          if (locked) {
            throw new OnlineCourseForbiddenError(
              'Complete previous required lessons before continuing.',
            );
          }

          const publishedOrdered = ordered
            .filter((r) => r.isActive && r.status === 'PUBLISHED')
            .sort((a, b) => {
              if (a.modulePosition !== b.modulePosition) {
                return a.modulePosition - b.modulePosition;
              }
              return a.position - b.position;
            })
            .map((r) => r.id);
          const neighbors = await resolveLessonNeighbors(
            publishedOrdered,
            lessonId,
          );

          const assets = await listOnlineLessonAssets(
            onlineCourses,
            lessonId,
          );
          const progressRow = progressByLessonId.get(lessonId);
          const body: StudentOnlineLessonDetail = {
            lesson: toOnlineLessonDto(lesson),
            progress: progressRow
              ? toOnlineLessonProgressDto(progressRow)
              : null,
            assets,
            locked: false,
            previousLessonId: neighbors.previousLessonId,
            nextLessonId: neighbors.nextLessonId,
          };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/students/me/online-courses/:slug/lessons/:lessonId/progress',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const slug = pathId(req.params['slug']);
          const lessonId = pathId(req.params['lessonId']);
          if (!slug || !lessonId) {
            throw new BadRequestError('Slug and lesson id are required.');
          }
          const course = await requirePublishedCourseBySlug(
            onlineCourses,
            slug,
          );
          await requireStudentAccess(onlineCourses, studentId, course.id);

          const courseIdForLesson =
            await onlineCourses.findCourseIdForLesson(lessonId);
          if (courseIdForLesson !== course.id) {
            throw new OnlineCourseNotFoundError('Lesson not found.');
          }

          const parsed = updateOnlineLessonProgressRequestSchema.safeParse(
            req.body,
          );
          if (!parsed.success) {
            throw new BadRequestError(
              'status must be IN_PROGRESS or COMPLETED.',
            );
          }

          let progress: OnlineLessonProgress | null;
          if (parsed.data.status === 'IN_PROGRESS') {
            progress = await startLesson(onlineCourses, {
              studentId,
              lessonId,
            });
          } else {
            progress = await completeLesson(onlineCourses, {
              studentId,
              lessonId,
            });
          }
          res.status(200).json({ progress });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/students/me/online-courses/:slug/lessons/:lessonId/quiz',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const slug = pathId(req.params['slug']);
          const lessonId = pathId(req.params['lessonId']);
          if (!slug || !lessonId) {
            throw new BadRequestError('Slug and lesson id are required.');
          }
          const course = await requirePublishedCourseBySlug(
            onlineCourses,
            slug,
          );
          await requireStudentAccess(onlineCourses, studentId, course.id);

          const courseIdForLesson =
            await onlineCourses.findCourseIdForLesson(lessonId);
          if (courseIdForLesson !== course.id) {
            throw new OnlineCourseNotFoundError('Lesson not found.');
          }

          const ordered = await onlineCourses.listLessonOrderRefs(course.id);
          const progressByLessonId = await getProgressMapForCourse(
            onlineCourses,
            studentId,
            course.id,
          );
          if (
            isLessonLockedInCourse(
              course.accessMode,
              lessonId,
              ordered,
              progressByLessonId,
            )
          ) {
            throw new OnlineCourseForbiddenError(
              'Complete previous required lessons before continuing.',
            );
          }

          const quiz = await getQuizPublic(onlineCourses, lessonId);
          res.status(200).json({ quiz } satisfies { quiz: OnlineQuizPublic });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/students/me/online-courses/:slug/lessons/:lessonId/quiz/submit',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const slug = pathId(req.params['slug']);
          const lessonId = pathId(req.params['lessonId']);
          if (!slug || !lessonId) {
            throw new BadRequestError('Slug and lesson id are required.');
          }
          const course = await requirePublishedCourseBySlug(
            onlineCourses,
            slug,
          );
          await requireStudentAccess(onlineCourses, studentId, course.id);

          const courseIdForLesson =
            await onlineCourses.findCourseIdForLesson(lessonId);
          if (courseIdForLesson !== course.id) {
            throw new OnlineCourseNotFoundError('Lesson not found.');
          }

          const parsed = submitOnlineQuizRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Invalid quiz answers payload.');
          }

          const result: OnlineQuizAttemptResult = await submitQuiz(
            onlineCourses,
            {
              lessonId,
              studentId,
              answers: parsed.data.answers,
            },
          );
          res.status(200).json(result);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/students/me/online-courses/:slug/lessons/:lessonId/submissions',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const slug = pathId(req.params['slug']);
          const lessonId = pathId(req.params['lessonId']);
          if (!slug || !lessonId) {
            throw new BadRequestError('Slug and lesson id are required.');
          }
          const course = await requirePublishedCourseBySlug(
            onlineCourses,
            slug,
          );
          await requireStudentAccess(onlineCourses, studentId, course.id);

          const courseIdForLesson =
            await onlineCourses.findCourseIdForLesson(lessonId);
          if (courseIdForLesson !== course.id) {
            throw new OnlineCourseNotFoundError('Lesson not found.');
          }

          const parsed = createOnlineLessonSubmissionRequestSchema.safeParse(
            req.body,
          );
          if (!parsed.success) {
            throw new BadRequestError('Invalid submission payload.');
          }

          const submission = await createSubmission(onlineCourses, {
            lessonId,
            studentId,
            body: parsed.data,
          });
          res.status(201).json({
            submission,
          } satisfies { submission: OnlineLessonSubmission | null });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.get(
    '/students/me/online-courses/:slug/lessons/:lessonId/submissions',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = await requireStudentId(
            students,
            req.user!.id,
            req.user!.role,
          );
          const slug = pathId(req.params['slug']);
          const lessonId = pathId(req.params['lessonId']);
          if (!slug || !lessonId) {
            throw new BadRequestError('Slug and lesson id are required.');
          }
          const course = await requirePublishedCourseBySlug(
            onlineCourses,
            slug,
          );
          await requireStudentAccess(onlineCourses, studentId, course.id);

          const courseIdForLesson =
            await onlineCourses.findCourseIdForLesson(lessonId);
          if (courseIdForLesson !== course.id) {
            throw new OnlineCourseNotFoundError('Lesson not found.');
          }

          const submissions = await listOwnSubmissions(
            onlineCourses,
            lessonId,
            studentId,
          );
          res.status(200).json({ submissions });
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  return router;
}
