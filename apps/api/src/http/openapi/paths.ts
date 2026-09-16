type JsonSchemaRef = { $ref: string };

type MediaJson = {
  content: { 'application/json': { schema: JsonSchemaRef } };
};

type Operation = {
  tags: string[];
  summary: string;
  description?: string;
  operationId: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<Record<string, unknown>>;
  requestBody?: {
    required?: boolean;
    content: { 'application/json': { schema: JsonSchemaRef } };
  };
  responses: Record<string, Record<string, unknown>>;
};

function ref(name: string): JsonSchemaRef {
  return { $ref: `#/components/schemas/${name}` };
}

function jsonSchema(name: string): MediaJson {
  return { content: { 'application/json': { schema: ref(name) } } };
}

function error(description: string): Record<string, unknown> {
  return { description, ...jsonSchema('ErrorEnvelope') };
}

const session = [{ sessionCookie: [] }];

function idParam(
  name: string,
  description: string,
  format: 'uuid' | 'string' = 'uuid',
): Record<string, unknown> {
  return {
    name,
    in: 'path',
    required: true,
    description,
    schema: format === 'uuid' ? { type: 'string', format: 'uuid' } : { type: 'string' },
  };
}

function civilQuery(name: string, description: string): Record<string, unknown> {
  return {
    name,
    in: 'query',
    required: true,
    description,
    schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', example: '2026-09-01' },
  };
}

/**
 * OpenAPI paths for every route currently mounted on the Express app.
 * Descriptions mirror ROUTE-MAP + real authz behaviour; no invented endpoints.
 */
export function buildOpenApiPaths(): Record<string, Record<string, Operation>> {
  return {
    '/health': {
      get: {
        tags: ['Infrastructure'],
        summary: 'Health check',
        description:
          '200/`ok` when configuration and database pass; 503/`degraded` otherwise. ' +
          'Does not expose secrets, connection strings, or configuration details.',
        operationId: 'getHealth',
        responses: {
          '200': { description: 'Healthy', ...jsonSchema('HealthResponse') },
          '503': { description: 'Degraded', ...jsonSchema('HealthResponse') },
        },
      },
    },

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        description:
          'Validates credentials and sets the HttpOnly `academia_session` cookie. ' +
          'Identical 401 for unknown user, wrong password, or inactive account. Throttled per IP.',
        operationId: 'login',
        requestBody: { required: true, ...jsonSchema('LoginRequest') },
        responses: {
          '200': { description: 'Authenticated', ...jsonSchema('SessionResponse') },
          '400': error('Invalid body'),
          '401': error('Invalid credentials'),
          '429': error('Too many login attempts'),
        },
      },
    },

    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        description: 'Clears the session cookie. Always 204.',
        operationId: 'logout',
        responses: {
          '204': { description: 'Cookie cleared' },
        },
      },
    },

    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current session',
        description:
          'Requires a valid session cookie. Reloads the user so revocation is immediate.',
        operationId: 'getCurrentSession',
        security: session,
        responses: {
          '200': { description: 'Current user', ...jsonSchema('SessionResponse') },
          '401': error('Missing or invalid session'),
        },
      },
    },

    '/users/directors': {
      post: {
        tags: ['Users'],
        summary: 'Provision DIRECTOR',
        description:
          'SUPER_ADMIN only + `users.create` (bypass). Idempotent create/re-assert. Role conflict → 409.',
        operationId: 'provisionDirector',
        security: session,
        requestBody: { required: true, ...jsonSchema('ProvisionDirectorRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('SessionResponse') },
          '200': { description: 'Already existed', ...jsonSchema('SessionResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '409': error('Email already used by another role'),
        },
      },
    },

    '/users/administratives': {
      post: {
        tags: ['Users'],
        summary: 'Provision ADMINISTRATIVE',
        description: '`requirePermission(users, create)`. SUPER_ADMIN/DIRECTOR bypass.',
        operationId: 'provisionAdministrative',
        security: session,
        requestBody: {
          required: true,
          ...jsonSchema('ProvisionAdministrativeRequest'),
        },
        responses: {
          '201': { description: 'Created', ...jsonSchema('SessionResponse') },
          '200': { description: 'Already existed', ...jsonSchema('SessionResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '409': error('Email already used by another role'),
        },
      },
    },

    '/users/teachers': {
      post: {
        tags: ['Users'],
        summary: 'Provision TEACHER user',
        description:
          '`requirePermission(users, create)`. Creates the User account (role TEACHER), not the Teacher academic profile.',
        operationId: 'provisionTeacherUser',
        security: session,
        requestBody: { required: true, ...jsonSchema('ProvisionTeacherRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('SessionResponse') },
          '200': { description: 'Already existed', ...jsonSchema('SessionResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '409': error('Email already used by another role'),
        },
      },
    },

    '/users/students': {
      post: {
        tags: ['Users'],
        summary: 'Provision STUDENT user',
        description:
          '`requirePermission(users, create)`. Creates the User account (role STUDENT), not the Student academic profile.',
        operationId: 'provisionStudentUser',
        security: session,
        requestBody: { required: true, ...jsonSchema('ProvisionStudentRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('SessionResponse') },
          '200': { description: 'Already existed', ...jsonSchema('SessionResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '409': error('Email already used by another role'),
        },
      },
    },

    '/permissions/catalog': {
      get: {
        tags: ['Permissions'],
        summary: 'Permission catalog',
        description: '`requirePermission(permissions, read)`. SUPER_ADMIN/DIRECTOR bypass.',
        operationId: 'getPermissionCatalog',
        security: session,
        responses: {
          '200': { description: 'Catalog', ...jsonSchema('PermissionListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/roles/administrative/permissions': {
      get: {
        tags: ['Permissions'],
        summary: 'List ADMINISTRATIVE grants',
        description: '`requirePermission(permissions, read)`.',
        operationId: 'listAdministrativePermissions',
        security: session,
        responses: {
          '200': { description: 'Grants', ...jsonSchema('PermissionListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Permissions'],
        summary: 'Grant ADMINISTRATIVE permission',
        description:
          '`requirePermission(permissions, update)`. Idempotent: 201 when newly granted, 200 when already present.',
        operationId: 'grantAdministrativePermission',
        security: session,
        requestBody: { required: true, ...jsonSchema('ManagePermissionRequest') },
        responses: {
          '201': { description: 'Granted', ...jsonSchema('PermissionMutationResponse') },
          '200': {
            description: 'Already granted',
            ...jsonSchema('PermissionMutationResponse'),
          },
          '400': error('Invalid body / not in catalog'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      delete: {
        tags: ['Permissions'],
        summary: 'Revoke ADMINISTRATIVE permission',
        description: '`requirePermission(permissions, update)`. Idempotent 204.',
        operationId: 'revokeAdministrativePermission',
        security: session,
        requestBody: { required: true, ...jsonSchema('ManagePermissionRequest') },
        responses: {
          '204': { description: 'Revoked or already absent' },
          '400': error('Invalid body / not in catalog'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/students': {
      get: {
        tags: ['Students'],
        summary: 'List students',
        description: '`requirePermission(students, read)`. Academic profiles only (no password hashes).',
        operationId: 'listStudents',
        security: session,
        responses: {
          '200': { description: 'List', ...jsonSchema('StudentListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Students'],
        summary: 'Create student profile',
        description:
          '`requirePermission(students, create)`. Creates User+Student or attaches a profile to an existing STUDENT user.',
        operationId: 'createStudent',
        security: session,
        requestBody: { required: true, ...jsonSchema('CreateStudentRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('StudentResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '409': error('Conflict'),
        },
      },
    },

    '/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Get student',
        description:
          '`students.read` or the authenticated STUDENT reading their own profile (ownership).',
        operationId: 'getStudent',
        security: session,
        parameters: [idParam('id', 'Student id')],
        responses: {
          '200': { description: 'Student', ...jsonSchema('StudentResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      patch: {
        tags: ['Students'],
        summary: 'Update student',
        description: '`requirePermission(students, update)`.',
        operationId: 'updateStudent',
        security: session,
        parameters: [idParam('id', 'Student id')],
        requestBody: { required: true, ...jsonSchema('UpdateStudentRequest') },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('StudentResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['Students'],
        summary: 'Deactivate student',
        description: '`requirePermission(students, delete)`. Soft delete (`isActive=false`).',
        operationId: 'deactivateStudent',
        security: session,
        parameters: [idParam('id', 'Student id')],
        responses: {
          '200': { description: 'Deactivated', ...jsonSchema('StudentResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/students/{id}/teacher': {
      get: {
        tags: ['Assignments'],
        summary: 'Current student→teacher assignment',
        description: '`assignments.read` or the own STUDENT.',
        operationId: 'getStudentTeacher',
        security: session,
        parameters: [idParam('id', 'Student id')],
        responses: {
          '200': {
            description: 'Current assignment (teacher may be null)',
            ...jsonSchema('TeacherAssignmentResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Student not found'),
        },
      },
      post: {
        tags: ['Assignments'],
        summary: 'Assign / replace teacher',
        description:
          '`requirePermission(assignments, create)`. TEACHER cannot self-assign (actor from session).',
        operationId: 'assignStudentTeacher',
        security: session,
        parameters: [idParam('id', 'Student id')],
        requestBody: { required: true, ...jsonSchema('AssignTeacherRequest') },
        responses: {
          '200': { description: 'Assigned', ...jsonSchema('TeacherAssignmentResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Conflict'),
        },
      },
      delete: {
        tags: ['Assignments'],
        summary: 'Clear student→teacher assignment',
        description: '`requirePermission(assignments, update)`.',
        operationId: 'clearStudentTeacher',
        security: session,
        parameters: [idParam('id', 'Student id')],
        responses: {
          '200': { description: 'Cleared', ...jsonSchema('TeacherAssignmentResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/teachers': {
      get: {
        tags: ['Teachers'],
        summary: 'List teachers',
        description: '`requirePermission(teachers, read)`.',
        operationId: 'listTeachers',
        security: session,
        responses: {
          '200': { description: 'List', ...jsonSchema('TeacherListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Teachers'],
        summary: 'Create teacher profile',
        description: '`requirePermission(teachers, create)`.',
        operationId: 'createTeacher',
        security: session,
        requestBody: { required: true, ...jsonSchema('CreateTeacherRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('TeacherResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '409': error('Conflict'),
        },
      },
    },

    '/teachers/{id}': {
      get: {
        tags: ['Teachers'],
        summary: 'Get teacher',
        description: '`teachers.read` or the authenticated TEACHER reading their own profile.',
        operationId: 'getTeacher',
        security: session,
        parameters: [idParam('id', 'Teacher id')],
        responses: {
          '200': { description: 'Teacher', ...jsonSchema('TeacherResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      patch: {
        tags: ['Teachers'],
        summary: 'Update teacher',
        description: '`requirePermission(teachers, update)`.',
        operationId: 'updateTeacher',
        security: session,
        parameters: [idParam('id', 'Teacher id')],
        requestBody: { required: true, ...jsonSchema('UpdateTeacherRequest') },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('TeacherResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['Teachers'],
        summary: 'Deactivate teacher',
        description: '`requirePermission(teachers, delete)`. Soft delete.',
        operationId: 'deactivateTeacher',
        security: session,
        parameters: [idParam('id', 'Teacher id')],
        responses: {
          '200': { description: 'Deactivated', ...jsonSchema('TeacherResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/courses': {
      get: {
        tags: ['Courses'],
        summary: 'List courses',
        description:
          '`requirePermission(courses, read)`. Includes `courseType`, `serviceType`, and derived `durationMinutes`.',
        operationId: 'listCourses',
        security: session,
        responses: {
          '200': { description: 'List', ...jsonSchema('CourseListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Courses'],
        summary: 'Create course',
        description:
          '`requirePermission(courses, create)`. Requires `courseType` + `serviceType`. ' +
          '`durationMinutes` is derived from serviceType (60/90/120) and is not writable.',
        operationId: 'createCourse',
        security: session,
        requestBody: { required: true, ...jsonSchema('CreateCourseRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('CourseResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/courses/{id}': {
      get: {
        tags: ['Courses'],
        summary: 'Get course',
        description: '`requirePermission(courses, read)`.',
        operationId: 'getCourse',
        security: session,
        parameters: [idParam('id', 'Course id')],
        responses: {
          '200': { description: 'Course', ...jsonSchema('CourseResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      patch: {
        tags: ['Courses'],
        summary: 'Update course',
        description:
          '`requirePermission(courses, update)`. May change `courseType` / `serviceType`; duration recomputed.',
        operationId: 'updateCourse',
        security: session,
        parameters: [idParam('id', 'Course id')],
        requestBody: { required: true, ...jsonSchema('UpdateCourseRequest') },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('CourseResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['Courses'],
        summary: 'Deactivate course',
        description: '`requirePermission(courses, delete)`. Soft delete.',
        operationId: 'deactivateCourse',
        security: session,
        parameters: [idParam('id', 'Course id')],
        responses: {
          '200': { description: 'Deactivated', ...jsonSchema('CourseResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/groups': {
      get: {
        tags: ['Groups'],
        summary: 'List groups',
        description: '`requirePermission(groups, read)`.',
        operationId: 'listGroups',
        security: session,
        responses: {
          '200': { description: 'List', ...jsonSchema('GroupListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Groups'],
        summary: 'Create group',
        description:
          '`requirePermission(groups, create)`. Requires an existing active Course.',
        operationId: 'createGroup',
        security: session,
        requestBody: { required: true, ...jsonSchema('CreateGroupRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('GroupResponse') },
          '400': error('Invalid body / inactive course'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Course not found'),
        },
      },
    },

    '/groups/{id}': {
      get: {
        tags: ['Groups'],
        summary: 'Get group',
        description: '`requirePermission(groups, read)`.',
        operationId: 'getGroup',
        security: session,
        parameters: [idParam('id', 'Group id')],
        responses: {
          '200': { description: 'Group', ...jsonSchema('GroupResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      patch: {
        tags: ['Groups'],
        summary: 'Update group',
        description:
          '`requirePermission(groups, update)`. Optional `scheduleOptionId` must reference an active ScheduleOption.',
        operationId: 'updateGroup',
        security: session,
        parameters: [idParam('id', 'Group id')],
        requestBody: { required: true, ...jsonSchema('UpdateGroupRequest') },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('GroupResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['Groups'],
        summary: 'Deactivate group',
        description: '`requirePermission(groups, delete)`. Soft delete.',
        operationId: 'deactivateGroup',
        security: session,
        parameters: [idParam('id', 'Group id')],
        responses: {
          '200': { description: 'Deactivated', ...jsonSchema('GroupResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/groups/{id}/teacher': {
      get: {
        tags: ['Groups'],
        summary: 'Group teacher',
        description: '`requirePermission(groups, read)`.',
        operationId: 'getGroupTeacher',
        security: session,
        parameters: [idParam('id', 'Group id')],
        responses: {
          '200': { description: 'Teacher link', ...jsonSchema('GroupTeacherResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      post: {
        tags: ['Groups'],
        summary: 'Assign group teacher',
        description:
          '`requirePermission(groups, update)`. Assigns/replaces an active Teacher. TEACHER self-assign allowed when permitted.',
        operationId: 'assignGroupTeacher',
        security: session,
        parameters: [idParam('id', 'Group id')],
        requestBody: { required: true, ...jsonSchema('AssignGroupTeacherRequest') },
        responses: {
          '200': { description: 'Assigned', ...jsonSchema('GroupTeacherResponse') },
          '400': error('Invalid body / inactive teacher'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['Groups'],
        summary: 'Clear group teacher',
        description: '`requirePermission(groups, update)`.',
        operationId: 'clearGroupTeacher',
        security: session,
        parameters: [idParam('id', 'Group id')],
        responses: {
          '200': { description: 'Cleared', ...jsonSchema('GroupTeacherResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/groups/{id}/students': {
      get: {
        tags: ['Enrollment'],
        summary: 'List active enrollments',
        description:
          '`requirePermission(groups, read)`. Returns active enrollments (ids; no extra private profile).',
        operationId: 'listGroupStudents',
        security: session,
        parameters: [idParam('id', 'Group id')],
        responses: {
          '200': { description: 'Enrollments', ...jsonSchema('EnrollmentListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Group not found'),
        },
      },
      post: {
        tags: ['Enrollment'],
        summary: 'Enroll student',
        description:
          '`requirePermission(groups, update)`. Student must be active. Max 15 active enrollments. ' +
          'Does not auto-assign Student→Teacher. Soft-reactivates a prior inactive enrollment when present.',
        operationId: 'enrollStudent',
        security: session,
        parameters: [idParam('id', 'Group id')],
        requestBody: { required: true, ...jsonSchema('EnrollStudentRequest') },
        responses: {
          '201': { description: 'Enrolled', ...jsonSchema('EnrollmentResponse') },
          '200': {
            description: 'Already active or reactivated',
            ...jsonSchema('EnrollmentResponse'),
          },
          '400': error('Invalid body / capacity / inactive student'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Conflict'),
        },
      },
    },

    '/groups/{id}/students/{studentId}': {
      delete: {
        tags: ['Enrollment'],
        summary: 'Deactivate enrollment',
        description: '`requirePermission(groups, update)`. Soft deactivate (`isActive=false`).',
        operationId: 'deactivateEnrollment',
        security: session,
        parameters: [
          idParam('id', 'Group id'),
          idParam('studentId', 'Student id'),
        ],
        responses: {
          '200': { description: 'Deactivated', ...jsonSchema('EnrollmentResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/groups/{id}/classes/generate': {
      post: {
        tags: ['Classes'],
        summary: 'Generate weekly class sessions',
        description:
          '`requirePermission(classes, create)` only (no Teacher ownership bypass). ' +
          'Requires Group ScheduleOption + academy `ACADEMY_TIMEZONE`. Civil `{ from, to }` inclusive, max 90 days. ' +
          'Idempotent via UNIQUE(groupId, startAt) → `skippedCount`. Teacher overlap → `conflictCount`. ' +
          '`meetingUrl` is always null on generated rows.',
        operationId: 'generateClassSessions',
        security: session,
        parameters: [idParam('id', 'Group id')],
        requestBody: {
          required: true,
          ...jsonSchema('GenerateClassSessionsRequest'),
        },
        responses: {
          '200': {
            description: 'Generation result',
            ...jsonSchema('GenerateClassSessionsResponse'),
          },
          '400': error('Invalid range / missing schedule'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Group not found'),
        },
      },
    },

    '/schedule-options': {
      get: {
        tags: ['Schedule'],
        summary: 'List schedule options',
        description: '`requirePermission(schedules, read)`. Weekly slot catalog (dropdown-ready).',
        operationId: 'listScheduleOptions',
        security: session,
        responses: {
          '200': {
            description: 'Catalog',
            ...jsonSchema('ScheduleOptionListResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Schedule'],
        summary: 'Create schedule option',
        description:
          '`requirePermission(schedules, create)`. day + start/end HH:mm; label derived.',
        operationId: 'createScheduleOption',
        security: session,
        requestBody: {
          required: true,
          ...jsonSchema('CreateScheduleOptionRequest'),
        },
        responses: {
          '201': { description: 'Created', ...jsonSchema('ScheduleOptionResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/schedule-options/{id}': {
      get: {
        tags: ['Schedule'],
        summary: 'Get schedule option',
        description: '`requirePermission(schedules, read)`.',
        operationId: 'getScheduleOption',
        security: session,
        parameters: [idParam('id', 'ScheduleOption id')],
        responses: {
          '200': { description: 'Option', ...jsonSchema('ScheduleOptionResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      patch: {
        tags: ['Schedule'],
        summary: 'Update schedule option',
        description: '`requirePermission(schedules, update)`.',
        operationId: 'updateScheduleOption',
        security: session,
        parameters: [idParam('id', 'ScheduleOption id')],
        requestBody: {
          required: true,
          ...jsonSchema('UpdateScheduleOptionRequest'),
        },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('ScheduleOptionResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['Schedule'],
        summary: 'Deactivate schedule option',
        description: '`requirePermission(schedules, delete)`. Soft delete.',
        operationId: 'deactivateScheduleOption',
        security: session,
        parameters: [idParam('id', 'ScheduleOption id')],
        responses: {
          '200': {
            description: 'Deactivated',
            ...jsonSchema('ScheduleOptionResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/classes': {
      get: {
        tags: ['Classes'],
        summary: 'List class sessions',
        description:
          'Auth required. `classes.read` → all; TEACHER → Groups they own; STUDENT → Groups with active Enrollment. ' +
          'Optional `?groupId=`.',
        operationId: 'listClassSessions',
        security: session,
        parameters: [
          {
            name: 'groupId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by group',
          },
        ],
        responses: {
          '200': { description: 'List', ...jsonSchema('ClassSessionListResponse') },
          '400': error('Invalid query'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Classes'],
        summary: 'Create class session',
        description:
          '`classes.create` (admin) or TEACHER of the Group. Duration from Course.serviceType. ' +
          'Optional https `meetingUrl`. Teacher schedule overlap → 409.',
        operationId: 'createClassSession',
        security: session,
        requestBody: {
          required: true,
          ...jsonSchema('CreateClassSessionRequest'),
        },
        responses: {
          '201': { description: 'Created', ...jsonSchema('ClassSessionResponse') },
          '400': error('Invalid body / missing schedule on group'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Schedule conflict'),
        },
      },
    },

    '/classes/calendar': {
      get: {
        tags: ['Classes'],
        summary: 'Calendar events',
        description:
          'Same ownership as list. Civil `from`/`to` in academy timezone (`ACADEMY_TIMEZONE`). ' +
          'Active sessions by `startAt`. Nested group/course/teacher + meetingUrl. Max 93 inclusive days.',
        operationId: 'getClassSessionCalendar',
        security: session,
        parameters: [
          civilQuery('from', 'Inclusive civil start date (YYYY-MM-DD) in academy timezone'),
          civilQuery('to', 'Inclusive civil end date (YYYY-MM-DD) in academy timezone'),
        ],
        responses: {
          '200': {
            description: 'Calendar window',
            ...jsonSchema('ClassSessionCalendarResponse'),
          },
          '400': error('Invalid / oversized range'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/classes/{id}': {
      get: {
        tags: ['Classes'],
        summary: 'Get class session',
        description: 'Same ownership as list. Out-of-scope id → 403 (IDOR-safe).',
        operationId: 'getClassSession',
        security: session,
        parameters: [idParam('id', 'ClassSession id')],
        responses: {
          '200': { description: 'Session', ...jsonSchema('ClassSessionResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      patch: {
        tags: ['Classes'],
        summary: 'Update class session',
        description:
          '`classes.update` (admin) or TEACHER of the Group. `startAt` / `isActive` / `meetingUrl`. Overlap on reschedule → 409.',
        operationId: 'updateClassSession',
        security: session,
        parameters: [idParam('id', 'ClassSession id')],
        requestBody: {
          required: true,
          ...jsonSchema('UpdateClassSessionRequest'),
        },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('ClassSessionResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Schedule conflict'),
        },
      },
      delete: {
        tags: ['Classes'],
        summary: 'Deactivate class session',
        description:
          '`classes.delete` (admin) or TEACHER of the Group. Soft delete (`isActive=false`).',
        operationId: 'deactivateClassSession',
        security: session,
        parameters: [idParam('id', 'ClassSession id')],
        responses: {
          '200': { description: 'Deactivated', ...jsonSchema('ClassSessionResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/classes/{id}/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'List attendance',
        description:
          'Same ClassSession ownership. Admin/Teacher → all rows; STUDENT → only their own. ' +
          'Student payload `{id,firstName,lastName}`.',
        operationId: 'listAttendance',
        security: session,
        parameters: [idParam('id', 'ClassSession id')],
        responses: {
          '200': { description: 'Rows', ...jsonSchema('AttendanceListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Create attendance',
        description:
          '`classes.update` or TEACHER of the Group. `{studentId,status}` PRESENT|ABSENT. ' +
          'Requires active enrollment. UNIQUE(classSessionId,studentId) → 409.',
        operationId: 'createAttendance',
        security: session,
        parameters: [idParam('id', 'ClassSession id')],
        requestBody: { required: true, ...jsonSchema('CreateAttendanceRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('AttendanceResponse') },
          '400': error('Invalid body / inactive enrollment'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Already recorded'),
        },
      },
    },

    '/classes/{id}/attendance/{studentId}': {
      patch: {
        tags: ['Attendance'],
        summary: 'Update attendance status',
        description:
          'Same write rule as POST. Only `status` PRESENT↔ABSENT. No DELETE endpoint.',
        operationId: 'updateAttendance',
        security: session,
        parameters: [
          idParam('id', 'ClassSession id'),
          idParam('studentId', 'Student id'),
        ],
        requestBody: { required: true, ...jsonSchema('UpdateAttendanceRequest') },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('AttendanceResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/classes/{id}/notes': {
      get: {
        tags: ['Notes'],
        summary: 'List class notes',
        description:
          'Same ClassSession ownership. Ordered `createdAt ASC, id ASC`. STUDENT is read-only.',
        operationId: 'listClassNotes',
        security: session,
        parameters: [idParam('id', 'ClassSession id')],
        responses: {
          '200': { description: 'Notes', ...jsonSchema('ClassNoteListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      post: {
        tags: ['Notes'],
        summary: 'Create class note',
        description:
          '`classes.update` or TEACHER of the Group. `{content}` trimmed, 1–4000 characters. Multiple notes allowed.',
        operationId: 'createClassNote',
        security: session,
        parameters: [idParam('id', 'ClassSession id')],
        requestBody: { required: true, ...jsonSchema('CreateClassNoteRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('ClassNoteResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/classes/{id}/notes/{noteId}': {
      patch: {
        tags: ['Notes'],
        summary: 'Update class note',
        description:
          'Same write rule as POST. Only `content`. Note must belong to `:id` (cross-session → 404).',
        operationId: 'updateClassNote',
        security: session,
        parameters: [
          idParam('id', 'ClassSession id'),
          idParam('noteId', 'Note id'),
        ],
        requestBody: { required: true, ...jsonSchema('UpdateClassNoteRequest') },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('ClassNoteResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['Notes'],
        summary: 'Delete class note',
        description: 'Same write rule as POST. Hard delete → 204.',
        operationId: 'deleteClassNote',
        security: session,
        parameters: [
          idParam('id', 'ClassSession id'),
          idParam('noteId', 'Note id'),
        ],
        responses: {
          '204': { description: 'Deleted' },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },
  };
}
