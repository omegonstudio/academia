import {
  addCivilDays,
  isCourseServiceType,
  studentAttendanceListQuerySchema,
  zonedLocalDateTimeToUtc,
  type MaterialListResponse,
  type StudentAttendanceListResponse,
  type StudentFinanceCheckoutResponse,
  type StudentFinanceResponse,
  type StudentResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { AcademyBusinessConfig } from '../../domain/academy/academy-config.js';
import type { AttendanceStore } from '../../domain/attendance/attendance-service.js';
import {
  FinanceConflictError,
  FinanceInvalidTransitionError,
  FinanceNotFoundError,
  FinanceValidationError,
} from '../../domain/finance/finance-errors.js';
import { startStudentCheckout } from '../../domain/finance/student-checkout.js';
import {
  getStudentFinancePortal,
  serializeStudentFinancePayment,
} from '../../domain/finance/student-finance-portal.js';
import type { FinanceStore } from '../../domain/finance/finance-store.js';
import {
  listEntitledMaterialsForStudent,
  type MaterialStore,
} from '../../domain/materials/material-service.js';
import {
  StudentNotFoundError,
  toStudentDto,
  type StudentStore,
} from '../../domain/students/student-service.js';
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

function mapStudentFinanceError(error: unknown): never {
  if (error instanceof FinanceValidationError) {
    throw new BadRequestError(error.message);
  }
  if (error instanceof FinanceNotFoundError) {
    throw new NotFoundError(error.message);
  }
  if (
    error instanceof FinanceConflictError ||
    error instanceof FinanceInvalidTransitionError
  ) {
    throw new ConflictError(error.message);
  }
  throw error;
}

export interface StudentHubDependencies {
  authenticate: AuthenticateOptions;
  students: StudentStore;
  materials: MaterialStore;
  attendances: AttendanceStore;
  academy: AcademyBusinessConfig;
  /** Optional until wired — required for student finance portal + checkout. */
  finance?: FinanceStore;
}

/**
 * Student Hub self-scoped routes.
 * All identity comes from the session — never from a client-supplied studentId.
 */
export function createStudentHubRouter({
  authenticate: authOptions,
  students,
  materials,
  attendances,
  academy,
  finance,
}: StudentHubDependencies): Router {
  const router = Router();

  router.get('/students/me', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const user = req.user!;
        if (user.role !== 'STUDENT') {
          throw new ForbiddenError('Only students can access this resource.');
        }
        const record = await students.findByUserId(user.id);
        if (!record) {
          throw new NotFoundError('Student profile not found.');
        }
        const body: StudentResponse = { student: toStudentDto(record) };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof StudentNotFoundError) {
          next(new NotFoundError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.get(
    '/students/me/materials',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const user = req.user!;
          if (user.role !== 'STUDENT') {
            throw new ForbiddenError('Only students can access this resource.');
          }
          const record = await students.findByUserId(user.id);
          if (!record) {
            throw new NotFoundError('Student profile not found.');
          }
          const list = await listEntitledMaterialsForStudent(
            materials,
            record.id,
          );
          const body: MaterialListResponse = { materials: list };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/students/me/attendance',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const user = req.user!;
          if (user.role !== 'STUDENT') {
            throw new ForbiddenError('Only students can access this resource.');
          }
          const record = await students.findByUserId(user.id);
          if (!record) {
            throw new NotFoundError('Student profile not found.');
          }

          const parsed = studentAttendanceListQuerySchema.safeParse(req.query);
          if (!parsed.success) {
            throw new BadRequestError(
              parsed.error.issues[0]?.message ??
                'Valid from and to civil dates are required.',
            );
          }

          const rangeStart = zonedLocalDateTimeToUtc(
            parsed.data.from,
            '00:00',
            academy.businessTimezone,
          );
          const rangeEndExclusive = zonedLocalDateTimeToUtc(
            addCivilDays(parsed.data.to, 1),
            '00:00',
            academy.businessTimezone,
          );

          const rows = await attendances.listForStudentInRange({
            studentId: record.id,
            rangeStart,
            rangeEndExclusive,
          });

          const body: StudentAttendanceListResponse = {
            from: parsed.data.from,
            to: parsed.data.to,
            attendances: rows.map((row) => {
              const serviceType = row.classSession.group.course.serviceType;
              if (!isCourseServiceType(serviceType)) {
                throw new Error(
                  `Invalid course serviceType: ${serviceType}`,
                );
              }
              return {
                id: row.id,
                classSessionId: row.classSessionId,
                studentId: row.studentId,
                status: row.status,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
                classSession: {
                  id: row.classSession.id,
                  startAt: row.classSession.startAt.toISOString(),
                  endAt: row.classSession.endAt.toISOString(),
                  group: {
                    id: row.classSession.group.id,
                    name: row.classSession.group.name,
                    course: {
                      id: row.classSession.group.course.id,
                      name: row.classSession.group.course.name,
                      serviceType,
                    },
                  },
                },
              };
            }),
          };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/students/me/finance',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          if (!finance) {
            throw new NotFoundError('Finance is not available.');
          }
          const user = req.user!;
          if (user.role !== 'STUDENT') {
            throw new ForbiddenError('Only students can access this resource.');
          }
          const record = await students.findByUserId(user.id);
          if (!record) {
            throw new NotFoundError('Student profile not found.');
          }
          const body: StudentFinanceResponse = await getStudentFinancePortal(
            finance,
            record.id,
          );
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/students/me/finance/charges/:chargeId/pay',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          if (!finance) {
            throw new NotFoundError('Finance is not available.');
          }
          const user = req.user!;
          if (user.role !== 'STUDENT') {
            throw new ForbiddenError('Only students can access this resource.');
          }
          const record = await students.findByUserId(user.id);
          if (!record) {
            throw new NotFoundError('Student profile not found.');
          }
          const chargeId = pathId(req.params.chargeId);
          if (!chargeId || !UUID_RE.test(chargeId)) {
            throw new BadRequestError('Valid chargeId is required.');
          }
          const payment = await startStudentCheckout(finance, {
            studentId: record.id,
            chargeId,
            createdByUserId: user.id,
          });
          const body: StudentFinanceCheckoutResponse = {
            payment: serializeStudentFinancePayment(payment),
          };
          res.status(201).json(body);
        } catch (error) {
          mapStudentFinanceError(error);
        }
      })().catch(next);
    },
  );

  return router;
}
