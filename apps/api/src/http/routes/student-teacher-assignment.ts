import {
  assignTeacherRequestSchema,
  type SessionUser,
  type TeacherAssignmentResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import { hasPermission } from '../../domain/authorization/has-permission.js';
import {
  AssignmentNotFoundError,
  AssignmentValidationError,
  assignTeacherToStudent,
  getStudentTeacherAssignment,
  unassignTeacherFromStudent,
  type TeacherAssignmentStore,
} from '../../domain/assignments/assignment-service.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/require-permission.js';

export interface StudentTeacherAssignmentDependencies {
  authenticate: AuthenticateOptions;
  assignments: TeacherAssignmentStore;
  permissionGrants: PermissionGrantStore;
}

async function mayReadAssignment(
  grants: PermissionGrantStore,
  user: SessionUser,
  studentUserId: string,
): Promise<boolean> {
  if (await hasPermission(grants, user.role, 'assignments', 'read')) {
    return true;
  }
  return user.role === 'STUDENT' && user.id === studentUserId;
}

function studentPathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

/**
 * Current Student → Teacher assignment under `/students/:id/teacher`.
 */
export function createStudentTeacherAssignmentRouter({
  authenticate: authOptions,
  assignments,
  permissionGrants,
}: StudentTeacherAssignmentDependencies): Router {
  const router = Router();

  router.get(
    '/students/:id/teacher',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = studentPathId(req.params['id']);
          if (!studentId) throw new BadRequestError('Student id is required.');

          const student = await assignments.findStudent(studentId);
          if (!student) {
            throw new NotFoundError('Student not found.');
          }

          const allowed = await mayReadAssignment(
            permissionGrants,
            req.user!,
            student.userId,
          );
          if (!allowed) {
            throw new ForbiddenError();
          }

          const assignment = await getStudentTeacherAssignment(
            assignments,
            studentId,
          );
          const body: TeacherAssignmentResponse = { assignment };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof AssignmentNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof AssignmentValidationError) {
            if (error.message === 'Student not found.') {
              next(new NotFoundError(error.message));
              return;
            }
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.post(
    '/students/:id/teacher',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'assignments', 'create'),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = studentPathId(req.params['id']);
          if (!studentId) throw new BadRequestError('Student id is required.');

          const parsed = assignTeacherRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('A valid teacherId is required.');
          }

          const assignment = await assignTeacherToStudent(
            assignments,
            studentId,
            parsed.data,
            { id: req.user!.id, role: req.user!.role },
          );
          const body: TeacherAssignmentResponse = { assignment };
          res.status(200).json(body);
        } catch (error) {
          if (error instanceof AssignmentValidationError) {
            if (error.message === 'Student not found.') {
              next(new NotFoundError(error.message));
              return;
            }
            if (error.message === 'Teacher not found.') {
              next(new NotFoundError(error.message));
              return;
            }
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/students/:id/teacher',
    authenticate(authOptions),
    requirePermission(permissionGrants, 'assignments', 'update'),
    (req, res, next) => {
      void (async () => {
        try {
          const studentId = studentPathId(req.params['id']);
          if (!studentId) throw new BadRequestError('Student id is required.');

          await unassignTeacherFromStudent(assignments, studentId);
          res.status(204).send();
        } catch (error) {
          if (error instanceof AssignmentNotFoundError) {
            next(new NotFoundError(error.message));
            return;
          }
          if (error instanceof AssignmentValidationError) {
            if (error.message === 'Student not found.') {
              next(new NotFoundError(error.message));
              return;
            }
            next(new BadRequestError(error.message));
            return;
          }
          next(error);
        }
      })();
    },
  );

  return router;
}
