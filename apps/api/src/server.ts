import { isApiDocsEnabled } from './config/docs-enabled.js';
import { evaluateConfiguration, parseEnv } from './config/env.js';
import { createAuthService } from './domain/identity/auth-service.js';
import { createAdministrativeProvisionStore } from './domain/identity/provision-administrative.js';
import { createDirectorProvisionStore } from './domain/identity/provision-director.js';
import { createStudentProvisionStore } from './domain/identity/provision-student.js';
import { createTeacherProvisionStore } from './domain/identity/provision-teacher.js';
import { createAdministrativePermissionStore } from './domain/authorization/administrative-permission-store.js';
import { createPermissionChangeAuditStore } from './domain/authorization/permission-change-audit-store.js';
import { createPermissionGrantStore } from './domain/authorization/permission-grant-store.js';
import { createStudentStore } from './domain/students/student-store.js';
import { createTeacherStore } from './domain/teachers/teacher-store.js';
import { createTeacherAssignmentStore } from './domain/assignments/assignment-store.js';
import { createCourseStore } from './domain/courses/course-store.js';
import { createGroupStore } from './domain/groups/group-store.js';
import { createEnrollmentStore } from './domain/enrollments/enrollment-store.js';
import { createScheduleOptionStore } from './domain/schedules/schedule-option-store.js';
import { getAcademyBusinessConfig } from './domain/academy/academy-config.js';
import { createClassSessionStore } from './domain/classes/class-session-store.js';
import { createAttendanceStore } from './domain/attendance/attendance-store.js';
import { createClassNoteStore } from './domain/class-notes/class-note-store.js';
import { createSessionCodec } from './domain/identity/session.js';
import { createUserRepository } from './domain/identity/user-repository.js';
import { createApp } from './http/app.js';
import { parseAllowedOrigins } from './http/middleware/cors.js';
import { createPrismaClient, isDatabaseReachable } from './lib/prisma.js';
import { logger } from './lib/logger.js';

const SHUTDOWN_GRACE_MS = 10_000;

async function main(): Promise<void> {
  const env = parseEnv();

  // A production process must not start misconfigured; in development the same
  // issues are surfaced as warnings so the loop stays fast.
  const issues = evaluateConfiguration(env);
  if (issues.length > 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error(`Refusing to start:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    }
    logger.warn({ issues }, 'Configuration issues detected');
  }

  const database = createPrismaClient(env.DATABASE_URL);
  const users = createUserRepository(database);
  const authService = createAuthService(users);
  const sessionCodec = createSessionCodec(env.AUTH_SECRET, env.AUTH_SESSION_TTL);
  const directors = createDirectorProvisionStore(database);
  const administratives = createAdministrativeProvisionStore(database);
  const teachers = createTeacherProvisionStore(database);
  const students = createStudentProvisionStore(database);
  const administrativePermissions =
    createAdministrativePermissionStore(database);
  const permissionGrants = createPermissionGrantStore(database);
  const permissionChangeAudits = createPermissionChangeAuditStore(database);
  const studentProfiles = createStudentStore(database);
  const teacherProfiles = createTeacherStore(database);
  const teacherAssignments = createTeacherAssignmentStore(database);
  const courses = createCourseStore(database);
  const groups = createGroupStore(database);
  const enrollments = createEnrollmentStore(database);
  const scheduleOptions = createScheduleOptionStore(database);
  const classSessions = createClassSessionStore(database);
  const attendances = createAttendanceStore(database);
  const classNotes = createClassNoteStore(database);
  const startedAt = Date.now();

  const authOptions = {
    authService,
    sessionCodec,
    cookieName: 'academia_session',
  } as const;

  const app = createApp({
    logger,
    allowedOrigins: parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
    health: {
      environment: env.NODE_ENV,
      isDatabaseReachable: () => isDatabaseReachable(database),
      configurationIssues: () => evaluateConfiguration(env),
      uptimeSeconds: () => Math.floor((Date.now() - startedAt) / 1000),
    },
    auth: {
      authService,
      sessionCodec,
      cookie: {
        name: 'academia_session',
        secure: env.NODE_ENV === 'production',
        ttlSeconds: env.AUTH_SESSION_TTL,
      },
    },
    directors: {
      authenticate: authOptions,
      directors,
      permissionGrants,
    },
    administratives: {
      authenticate: authOptions,
      administratives,
      permissionGrants,
    },
    teachers: {
      authenticate: authOptions,
      teachers,
      permissionGrants,
    },
    students: {
      authenticate: authOptions,
      students,
      permissionGrants,
    },
    studentRegistry: {
      authenticate: authOptions,
      students: studentProfiles,
      permissionGrants,
    },
    teacherRegistry: {
      authenticate: authOptions,
      teachers: teacherProfiles,
      permissionGrants,
    },
    studentTeacherAssignment: {
      authenticate: authOptions,
      assignments: teacherAssignments,
      permissionGrants,
    },
    courses: {
      authenticate: authOptions,
      courses,
      permissionGrants,
    },
    groups: {
      authenticate: authOptions,
      groups,
      enrollments,
      classSessions,
      academy: getAcademyBusinessConfig(env),
      permissionGrants,
    },
    scheduleOptions: {
      authenticate: authOptions,
      scheduleOptions,
      permissionGrants,
    },
    classSessions: {
      authenticate: authOptions,
      classSessions,
      attendances,
      classNotes,
      teachers: teacherProfiles,
      students: studentProfiles,
      academy: getAcademyBusinessConfig(env),
      permissionGrants,
    },
    administrativePermissions: {
      authenticate: authOptions,
      administrativePermissions,
      permissionGrants,
      permissionChangeAudits,
    },
    docsEnabled: isApiDocsEnabled(env),
  });

  const server = app.listen(env.API_PORT, () => {
    logger.info(
      { port: env.API_PORT, environment: env.NODE_ENV },
      'API listening',
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');

    const timer = setTimeout(() => {
      logger.error('Forced shutdown after grace period');
      process.exit(1);
    }, SHUTDOWN_GRACE_MS);
    timer.unref();

    server.close(() => {
      void database.$disconnect().then(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API failed to start');
  process.exit(1);
});
