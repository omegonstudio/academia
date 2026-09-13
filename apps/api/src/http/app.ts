import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { cors } from './middleware/cors.js';
import {
  createAdministrativesRouter,
  type AdministrativesDependencies,
} from './routes/administratives.js';
import { createAuthRouter, type AuthDependencies } from './routes/auth.js';
import {
  createDirectorsRouter,
  type DirectorsDependencies,
} from './routes/directors.js';
import { createHealthRouter, type HealthDependencies } from './routes/health.js';
import {
  createStudentsRouter,
  type StudentsDependencies,
} from './routes/students.js';
import {
  createStudentRegistryRouter,
  type StudentRegistryDependencies,
} from './routes/student-registry.js';
import {
  createTeachersRouter,
  type TeachersDependencies,
} from './routes/teachers.js';
import {
  createAdministrativePermissionsRouter,
  type AdministrativePermissionsDependencies,
} from './routes/administrative-permissions.js';

export interface AppDependencies {
  logger: Logger;
  allowedOrigins: string[];
  health: HealthDependencies;
  auth: AuthDependencies;
  directors: DirectorsDependencies;
  administratives: AdministrativesDependencies;
  teachers: TeachersDependencies;
  students: StudentsDependencies;
  studentRegistry: StudentRegistryDependencies;
  administrativePermissions: AdministrativePermissionsDependencies;
}

/**
 * Builds the Express application from injected dependencies.
 *
 * Kept free of process concerns (port binding, signal handling, database
 * construction) so tests can exercise the real middleware stack.
 */
export function createApp({
  logger,
  allowedOrigins,
  health,
  auth,
  directors,
  administratives,
  teachers,
  students,
  studentRegistry,
  administrativePermissions,
}: AppDependencies): Express {
  const app = express();

  // Required for req.ip to reflect the client when running behind the
  // Next.js proxy or an ingress.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      // Health probes run continuously; keep them out of the log at info level.
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  );

  app.use(cors(allowedOrigins));
  app.use(express.json({ limit: '64kb' }));

  app.use(createHealthRouter(health));
  app.use(createAuthRouter(auth));
  app.use(createDirectorsRouter(directors));
  app.use(createAdministrativesRouter(administratives));
  app.use(createTeachersRouter(teachers));
  app.use(createStudentsRouter(students));
  app.use(createStudentRegistryRouter(studentRegistry));
  app.use(createAdministrativePermissionsRouter(administrativePermissions));

  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return app;
}
