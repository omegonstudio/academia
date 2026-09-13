import {
  provisionStudentRequestSchema,
  type SessionResponse,
} from '@academia/shared';
import { Router } from 'express';
import {
  provisionStudent,
  RoleConflictError,
  type StudentProvisionStore,
} from '../../domain/identity/provision-student.js';
import { BadRequestError, ConflictError } from '../errors.js';
import {
  authenticate,
  requireRole,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface StudentsDependencies {
  authenticate: AuthenticateOptions;
  students: StudentProvisionStore;
}

/**
 * Student provisioning.
 *
 * DIRECTOR operates the academy and may create STUDENT accounts.
 * SUPER_ADMIN retains technical access. Teachers cannot self-assign students,
 * so TEACHER is not authorized here. The role is assigned server-side.
 */
export function createStudentsRouter({
  authenticate: authOptions,
  students,
}: StudentsDependencies): Router {
  const router = Router();

  router.post(
    '/users/students',
    authenticate(authOptions),
    requireRole('SUPER_ADMIN', 'DIRECTOR'),
    (req, res, next) => {
      void (async () => {
        try {
          const parsed = provisionStudentRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'A valid email, password (min. 12 characters) and optional name are required.',
            );
          }

          const { outcome, user } = await provisionStudent(students, parsed.data);
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
