import {
  provisionTeacherRequestSchema,
  type SessionResponse,
} from '@academia/shared';
import { Router } from 'express';
import {
  provisionTeacher,
  RoleConflictError,
  type TeacherProvisionStore,
} from '../../domain/identity/provision-teacher.js';
import { BadRequestError, ConflictError } from '../errors.js';
import {
  authenticate,
  requireRole,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface TeachersDependencies {
  authenticate: AuthenticateOptions;
  teachers: TeacherProvisionStore;
}

/**
 * Teacher provisioning.
 *
 * DIRECTOR operates the academy and may create TEACHER accounts.
 * SUPER_ADMIN retains technical access. The role is assigned server-side.
 */
export function createTeachersRouter({
  authenticate: authOptions,
  teachers,
}: TeachersDependencies): Router {
  const router = Router();

  router.post(
    '/users/teachers',
    authenticate(authOptions),
    requireRole('SUPER_ADMIN', 'DIRECTOR'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = provisionTeacherRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A valid email, password (min. 12 characters) and optional name are required.',
            );
          }

          const { outcome, user } = await provisionTeacher(teachers, parsed.data);
          const body: SessionResponse = { user };
          res.status(outcome === 'created' ? 201 : 200).json(body);
        } catch (error) {
          if (error instanceof RoleConflictError) {
            next(new ConflictError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  return router;
}
