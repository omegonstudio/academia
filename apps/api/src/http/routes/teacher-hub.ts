import {
  addCivilDays,
  isCourseServiceType,
  teacherAttendanceListQuerySchema,
  zonedLocalDateTimeToUtc,
  type MaterialListResponse,
  type TeacherAttendanceListResponse,
  type TeacherHubStudentListResponse,
  type TeacherResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { AcademyBusinessConfig } from '../../domain/academy/academy-config.js';
import type { AttendanceStore } from '../../domain/attendance/attendance-service.js';
import {
  listOwnedMaterialsForTeacher,
  type MaterialStore,
} from '../../domain/materials/material-service.js';
import {
  listRelatedStudentsForTeacher,
  type TeacherRelatedStudentsStore,
} from '../../domain/teachers/teacher-related-students.js';
import {
  TeacherNotFoundError,
  toTeacherDto,
  type TeacherStore,
} from '../../domain/teachers/teacher-service.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface TeacherHubDependencies {
  authenticate: AuthenticateOptions;
  teachers: TeacherStore;
  relatedStudents: TeacherRelatedStudentsStore;
  materials: MaterialStore;
  attendances: AttendanceStore;
  academy: AcademyBusinessConfig;
}

/**
 * Teacher Hub self-scoped routes.
 * All identity comes from the session — never from a client-supplied teacherId.
 */
export function createTeacherHubRouter({
  authenticate: authOptions,
  teachers,
  relatedStudents,
  materials,
  attendances,
  academy,
}: TeacherHubDependencies): Router {
  const router = Router();

  async function requireTeacher(userId: string, role: string) {
    if (role !== 'TEACHER') {
      throw new ForbiddenError('Only teachers can access this resource.');
    }
    const record = await teachers.findByUserId(userId);
    if (!record) {
      throw new NotFoundError('Teacher profile not found.');
    }
    return record;
  }

  router.get('/teachers/me', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const user = req.user!;
        const record = await requireTeacher(user.id, user.role);
        const body: TeacherResponse = { teacher: toTeacherDto(record) };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof TeacherNotFoundError) {
          next(new NotFoundError(error.message));
          return;
        }
        next(error);
      }
    })();
  });

  router.get(
    '/teachers/me/students',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const user = req.user!;
          const record = await requireTeacher(user.id, user.role);
          const students = await listRelatedStudentsForTeacher(
            relatedStudents,
            record.id,
          );
          const body: TeacherHubStudentListResponse = { students };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/teachers/me/materials',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const user = req.user!;
          const record = await requireTeacher(user.id, user.role);
          const list = await listOwnedMaterialsForTeacher(materials, record.id);
          const body: MaterialListResponse = { materials: list };
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/teachers/me/attendance',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const user = req.user!;
          const record = await requireTeacher(user.id, user.role);

          const parsed = teacherAttendanceListQuerySchema.safeParse(req.query);
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

          const rows = await attendances.listForTeacherInRange({
            teacherId: record.id,
            rangeStart,
            rangeEndExclusive,
          });

          const body: TeacherAttendanceListResponse = {
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
                student: {
                  id: row.student.id,
                  firstName: row.student.firstName,
                  lastName: row.student.lastName,
                },
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

  return router;
}
