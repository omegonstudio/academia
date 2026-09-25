import {
  createCourseRequestSchema,
  updateCourseRequestSchema,
  type CourseListResponse,
  type CourseResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import {
  CourseNotFoundError,
  createCourse,
  deleteCourse,
  getCourse,
  listCourses,
  updateCourse,
  type CourseStore,
} from '../../domain/courses/course-service.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface CoursesDependencies {
  authenticate: AuthenticateOptions;
  courses: CourseStore;
  permissionGrants: PermissionGrantStore;
}

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

export function createCoursesRouter({
  authenticate: authOptions,
  courses,
  permissionGrants,
}: CoursesDependencies): Router {
  const router = Router();

  router.get(
    '/courses',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'courses', 'read'),
    (_req, res, next) => {
      void (async () => {
        try {
          const body: CourseListResponse = {
            courses: await listCourses(courses),
          };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/courses',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'courses', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = createCourseRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid name, courseType and serviceType are required.',
            );
          }
          const course = await createCourse(courses, parsed.data);
          const body: CourseResponse = { course };
          res.status(201).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/courses/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'courses', 'read'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const course = await getCourse(courses, id);
          const body: CourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof CourseNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.patch(
    '/courses/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'courses', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const parsed = updateCourseRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Provide at least one of name, description, courseType, serviceType or isActive.',
            );
          }
          const course = await updateCourse(courses, id, parsed.data);
          const body: CourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof CourseNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/courses/:id',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'courses', 'delete'),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params['id']);
          if (!id) throw new BadRequestError('Course id is required.');
          const course = await deleteCourse(courses, id);
          const body: CourseResponse = { course };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof CourseNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  return router;
}
