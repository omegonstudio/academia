import { openApiComponents } from './components.js';
import { buildOpenApiPaths } from './paths.js';

export interface OpenApiDocument {
  openapi: '3.0.3';
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  paths: ReturnType<typeof buildOpenApiPaths>;
  components: typeof openApiComponents;
}

/**
 * Academia API OpenAPI 3 document.
 *
 * Schemas are derived from `@academia/shared` Zod contracts via `z.toJSONSchema`
 * (OpenAPI 3.0 target). Paths describe the Express routes that exist today.
 *
 * No secrets, env values, or live credentials appear in this document.
 */
export function buildOpenApiDocument(): OpenApiDocument {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Academia API',
      version: '0.4.0',
      description: [
        'HTTP API for Omegon Academia.',
        '',
        '## Authentication',
        'Session cookie `academia_session` (HttpOnly), set by `POST /auth/login`.',
        'There is no Bearer/JWT surface. Prefer calling the API through the Next.js',
        'rewrite (`/api/*`) so the browser keeps same-origin cookies for Swagger Try it out.',
        '',
        '## Authorization',
        'Server-side `requirePermission` + ownership rules are authoritative.',
        'Roles: SUPER_ADMIN, DIRECTOR, ADMINISTRATIVE, TEACHER, STUDENT.',
        'SUPER_ADMIN/DIRECTOR bypass permission grants; ADMINISTRATIVE depends on grants;',
        'TEACHER/STUDENT use ownership where documented.',
        '',
        '## Academy timezone',
        'Civil dates for calendar/generate use `ACADEMY_TIMEZONE` (IANA; default',
        '`America/Argentina/Buenos_Aires`). Not per-user.',
      ].join('\n'),
    },
    servers: [
      {
        url: '/api',
        description:
          'Browser via Next.js rewrite (use with Swagger at /api/docs + session cookie)',
      },
      {
        url: '/',
        description: 'Direct API (Insomnia/curl against API_PORT)',
      },
    ],
    tags: [
      { name: 'Infrastructure', description: 'Health and ops probes' },
      { name: 'Auth', description: 'Session login/logout' },
      { name: 'Users', description: 'Role user provisioning' },
      { name: 'Permissions', description: 'Catalog and ADMINISTRATIVE grants' },
      { name: 'Students', description: 'Student academic profiles' },
      { name: 'Teachers', description: 'Teacher academic profiles' },
      { name: 'Assignments', description: 'Student → Teacher current link' },
      { name: 'Courses', description: 'Courses (courseType + serviceType)' },
      { name: 'Groups', description: 'Groups, teacher link, enrollment capacity' },
      { name: 'Enrollment', description: 'Group membership (max 15 active)' },
      { name: 'Schedule', description: 'Weekly ScheduleOption catalog' },
      { name: 'Classes', description: 'ClassSession CRUD, generate, calendar' },
      { name: 'Attendance', description: 'PRESENT / ABSENT per enrolled student' },
      { name: 'Notes', description: 'Class session text notes' },
    ],
    paths: buildOpenApiPaths(),
    components: openApiComponents,
  };
}
