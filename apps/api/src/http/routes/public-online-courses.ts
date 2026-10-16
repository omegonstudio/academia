import {
  isOnlineCourseFree,
  type OnlineCourse,
  type PublicOnlineCourse,
  type PublicOnlineCourseListResponse,
  type PublicOnlineCourseResponse,
} from '@academia/shared';
import { Router } from 'express';
import {
  OnlineCourseNotFoundError,
  listPublishedOnlineCourses,
  toOnlineCourseDto,
  type OnlineCourseStore,
} from '../../domain/online-courses/online-course-service.js';
import { BadRequestError, NotFoundError } from '../errors.js';

export interface PublicOnlineCoursesDependencies {
  onlineCourses: OnlineCourseStore;
}

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

async function buildPublicOnlineCourse(
  store: OnlineCourseStore,
  course: OnlineCourse,
): Promise<PublicOnlineCourse> {
  const modules = await store.listModules(course.id, {
    includeInactive: false,
  });
  const moduleBlocks: PublicOnlineCourse['modules'] = [];

  for (const mod of modules) {
    const lessons = await store.listLessons(mod.id, {
      includeInactive: false,
    });
    const published = lessons.filter((l) => l.status === 'PUBLISHED');
    const lessonBlocks: PublicOnlineCourse['modules'][number]['lessons'] = [];

    for (const lesson of published) {
      const assets = await store.listAssets(lesson.id, {
        includeInactive: false,
      });
      const kinds = [...new Set(assets.map((a) => a.kind))];
      lessonBlocks.push({
        id: lesson.id,
        title: lesson.title,
        estimatedMinutes: lesson.estimatedMinutes,
        position: lesson.position,
        assetKinds: kinds,
      });
    }

    moduleBlocks.push({
      id: mod.id,
      title: mod.title,
      description: mod.description,
      position: mod.position,
      lessons: lessonBlocks,
    });
  }

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    subtitle: course.subtitle,
    description: course.description,
    authorName: course.authorName ?? null,
    coverImageUrl: course.coverImageUrl,
    benefits: course.benefits,
    bonus: course.bonus,
    accessMode: course.accessMode,
    certificateEnabled: course.certificateEnabled,
    amountMinor: course.amountMinor,
    currency: course.currency,
    isFree: isOnlineCourseFree(course.amountMinor),
    modules: moduleBlocks,
  };
}

function toPublicListItem(
  course: PublicOnlineCourse,
): PublicOnlineCourseListResponse['courses'][number] {
  const { modules: _modules, ...rest } = course;
  return rest;
}

/**
 * Public catalogue — no auth required.
 * Only PUBLISHED + isActive courses; never exposes private asset URLs.
 */
export function createPublicOnlineCoursesRouter({
  onlineCourses,
}: PublicOnlineCoursesDependencies): Router {
  const router = Router();

  router.get('/public/online-courses', (_req, res, next) => {
    void (async () => {
      try {
        const published = await listPublishedOnlineCourses(onlineCourses);
        const courses: PublicOnlineCourseListResponse['courses'] = [];
        for (const course of published) {
          const full = await buildPublicOnlineCourse(onlineCourses, course);
          courses.push(toPublicListItem(full));
        }
        const body: PublicOnlineCourseListResponse = { courses };
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    })();
  });

  router.get('/public/online-courses/:slug', (req, res, next) => {
    void (async () => {
      try {
        const slug = pathId(req.params['slug']);
        if (!slug) throw new BadRequestError('Slug is required.');

        const row = await onlineCourses.findBySlug(slug);
        if (!row || !row.isActive || row.status !== 'PUBLISHED') {
          throw new OnlineCourseNotFoundError();
        }

        const course = toOnlineCourseDto(row);
        const publicCourse = await buildPublicOnlineCourse(
          onlineCourses,
          course,
        );
        const body: PublicOnlineCourseResponse = { course: publicCourse };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof OnlineCourseNotFoundError) {
          next(new NotFoundError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  return router;
}
