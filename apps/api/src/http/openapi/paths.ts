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

    '/students/me': {
      get: {
        tags: ['StudentHub'],
        summary: 'Get authenticated student profile',
        description:
          'Session-only. STUDENT role required. Resolves the Student profile for `req.user.id` — never accepts a client studentId.',
        operationId: 'getStudentMe',
        security: session,
        responses: {
          '200': { description: 'Own profile', ...jsonSchema('StudentResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Student profile not found'),
        },
      },
    },

    '/students/me/materials': {
      get: {
        tags: ['StudentHub'],
        summary: 'List materials entitled to the authenticated student',
        description:
          'READY materials for courses/class sessions where the student has an active enrollment. Session identity only.',
        operationId: 'listStudentMeMaterials',
        security: session,
        responses: {
          '200': { description: 'List', ...jsonSchema('MaterialListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Student profile not found'),
        },
      },
    },

    '/students/me/attendance': {
      get: {
        tags: ['StudentHub'],
        summary: 'List own attendance in a civil date range',
        description:
          'Read-only. Session identity only. Query `from`/`to` civil dates (academy timezone), same window rules as calendar.',
        operationId: 'listStudentMeAttendance',
        security: session,
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Own attendance rows',
            ...jsonSchema('StudentAttendanceListResponse'),
          },
          '400': error('Invalid range'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Student profile not found'),
        },
      },
    },

    '/students/me/finance': {
      get: {
        tags: ['StudentHub'],
        summary: 'Finance portal for the authenticated student',
        description:
          'Session-only. Returns charges, payments, refunds and a summary for the student resolved from `req.user.id`. Never accepts a client studentId. Omits academy/teacher split and settlements.',
        operationId: 'getStudentMeFinance',
        security: session,
        responses: {
          '200': {
            description: 'Own finance snapshot',
            ...jsonSchema('StudentFinanceResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Student profile not found'),
        },
      },
    },

    '/students/me/finance/charges/{chargeId}/pay': {
      post: {
        tags: ['StudentHub'],
        summary: 'Start checkout for an owned OPEN charge',
        description:
          'Session STUDENT only. Resolves Student from session, verifies Charge ownership and OPEN status, creates a PENDING Payment via the currency→provider stub (ARS→Mercado Pago, USD/EUR→Stripe). Never uses MANUAL. Idempotent: retries return the same PENDING Payment. Does not mark SUCCEEDED or create RevenueAllocation — that happens via provider webhook.',
        operationId: 'payStudentMeFinanceCharge',
        security: session,
        parameters: [
          {
            name: 'chargeId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '201': {
            description: 'PENDING Payment (new or idempotent re-entry)',
            ...jsonSchema('StudentFinanceCheckoutResponse'),
          },
          '400': error('Charge not OPEN or invalid chargeId'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Charge or student profile not found'),
          '409': error('Charge already has a non-PENDING Payment'),
        },
      },
    },

    '/teachers/me': {
      get: {
        tags: ['TeacherHub'],
        summary: 'Get authenticated teacher profile',
        description:
          'Session-only. TEACHER role required. Resolves the Teacher profile for `req.user.id` — never accepts a client teacherId.',
        operationId: 'getTeacherMe',
        security: session,
        responses: {
          '200': { description: 'Own profile', ...jsonSchema('TeacherResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Teacher profile not found'),
        },
      },
    },

    '/teachers/me/students': {
      get: {
        tags: ['TeacherHub'],
        summary: 'List students related to the authenticated teacher',
        description:
          'Union of TeacherAssignment and active enrollments in groups taught by the session teacher. Session identity only.',
        operationId: 'listTeacherMeStudents',
        security: session,
        responses: {
          '200': {
            description: 'Related students',
            ...jsonSchema('TeacherHubStudentListResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Teacher profile not found'),
        },
      },
    },

    '/teachers/me/materials': {
      get: {
        tags: ['TeacherHub'],
        summary: 'List materials owned by the authenticated teacher',
        description:
          'Materials on courses/class sessions where Group.teacherId matches the session teacher. Session identity only.',
        operationId: 'listTeacherMeMaterials',
        security: session,
        responses: {
          '200': { description: 'List', ...jsonSchema('MaterialListResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Teacher profile not found'),
        },
      },
    },

    '/teachers/me/attendance': {
      get: {
        tags: ['TeacherHub'],
        summary: 'List attendance for own ClassSessions in a civil date range',
        description:
          'Read-only aggregate. Session identity only. Query `from`/`to` civil dates (academy timezone).',
        operationId: 'listTeacherMeAttendance',
        security: session,
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Attendance on owned sessions',
            ...jsonSchema('TeacherAttendanceListResponse'),
          },
          '400': error('Invalid range'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Teacher profile not found'),
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

    '/materials': {
      get: {
        tags: ['Materials'],
        summary: 'List materials',
        description:
          'Exactly one of `courseId` or `classSessionId` (XOR). ' +
          '`materials.read` (admin) sees all active in scope; TEACHER via Group ownership; ' +
          'STUDENT only READY materials they are entitled to.',
        operationId: 'listMaterials',
        security: session,
        parameters: [
          {
            name: 'courseId',
            in: 'query',
            required: false,
            description: 'Course scope (mutually exclusive with classSessionId)',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'classSessionId',
            in: 'query',
            required: false,
            description:
              'ClassSession scope (mutually exclusive with courseId)',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Materials',
            ...jsonSchema('MaterialListResponse'),
          },
          '400': error('Missing or ambiguous scope'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Materials'],
        summary: 'Create LINK material',
        description:
          'Creates a READY LINK material. `externalUrl` must be absolute https. ' +
          '`materials.create` or TEACHER owning the association target. Students cannot create.',
        operationId: 'createMaterialLink',
        security: session,
        requestBody: { required: true, ...jsonSchema('CreateMaterialRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('MaterialResponse') },
          '400': error('Invalid body or association'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/materials/uploads': {
      post: {
        tags: ['Materials'],
        summary: 'Create FILE upload intent',
        description:
          'Creates a PENDING FILE material and returns a short-lived presigned PUT URL. ' +
          'MIME allowlist + size limits enforced. Client uploads then calls complete.',
        operationId: 'createMaterialUpload',
        security: session,
        requestBody: {
          required: true,
          ...jsonSchema('CreateMaterialUploadRequest'),
        },
        responses: {
          '201': {
            description: 'Upload intent',
            ...jsonSchema('MaterialUploadResponse'),
          },
          '400': error('Invalid body, MIME, size, or association'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/materials/{id}': {
      get: {
        tags: ['Materials'],
        summary: 'Get material',
        description:
          'Public metadata only (never `storageKey`). Same read entitlement as list.',
        operationId: 'getMaterial',
        security: session,
        parameters: [idParam('id', 'Material id')],
        responses: {
          '200': { description: 'Material', ...jsonSchema('MaterialResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      patch: {
        tags: ['Materials'],
        summary: 'Update material metadata',
        description:
          'Title and/or description only. `materials.update` or owning TEACHER.',
        operationId: 'updateMaterial',
        security: session,
        parameters: [idParam('id', 'Material id')],
        requestBody: { required: true, ...jsonSchema('UpdateMaterialRequest') },
        responses: {
          '200': { description: 'Updated', ...jsonSchema('MaterialResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['Materials'],
        summary: 'Soft-delete material',
        description:
          'Sets `isActive=false` (no `materials.delete` permission). ' +
          'Authorizes via `materials.update` or owning TEACHER. Best-effort object delete for FILE.',
        operationId: 'deleteMaterial',
        security: session,
        parameters: [idParam('id', 'Material id')],
        responses: {
          '204': { description: 'Soft-deleted' },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/materials/{id}/complete': {
      post: {
        tags: ['Materials'],
        summary: 'Complete FILE upload',
        description:
          'Verifies object exists, size within limit, and magic bytes match declared MIME. ' +
          'PENDING → READY. `materials.update` or owning TEACHER.',
        operationId: 'completeMaterialUpload',
        security: session,
        parameters: [idParam('id', 'Material id')],
        responses: {
          '200': { description: 'Ready', ...jsonSchema('MaterialResponse') },
          '400': error('Missing object, magic mismatch, or not pending'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/materials/{id}/download': {
      get: {
        tags: ['Materials'],
        summary: 'Download material',
        description:
          'LINK → `{kind, externalUrl}`. FILE READY → short-lived signed GET URL. ' +
          'Same read entitlement; students cannot download PENDING.',
        operationId: 'downloadMaterial',
        security: session,
        parameters: [idParam('id', 'Material id')],
        responses: {
          '200': {
            description: 'Download descriptor',
            ...jsonSchema('MaterialDownloadResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/finance/settings': {
      get: {
        tags: ['Finance'],
        summary: 'Get finance settings',
        description:
          '`requirePermission(finance, read)`. SUPER_ADMIN/DIRECTOR bypass. ' +
          'Returns current `academyPercentage` (creates defaults if absent).',
        operationId: 'getFinanceSettings',
        security: session,
        responses: {
          '200': {
            description: 'Settings',
            ...jsonSchema('FinanceSettingsResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      patch: {
        tags: ['Finance'],
        summary: 'Update finance settings',
        description:
          'SUPER_ADMIN/DIRECTOR role gate only (not `finance.update`). ' +
          '`academyPercentage` ∈ {20, 30, 40, 50}. Does not rewrite frozen allocations.',
        operationId: 'updateFinanceSettings',
        security: session,
        requestBody: {
          required: true,
          ...jsonSchema('UpdateFinanceSettingsRequest'),
        },
        responses: {
          '200': {
            description: 'Updated',
            ...jsonSchema('FinanceSettingsResponse'),
          },
          '400': error('Invalid academyPercentage'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/finance/charges': {
      get: {
        tags: ['Finance'],
        summary: 'List charges',
        description:
          'Auth required. `finance.read` (admin) → all; STUDENT/TEACHER → ownership scope. ' +
          'Optional filters: studentId, teacherId, courseId, classSessionId, status, currency.',
        operationId: 'listCharges',
        security: session,
        parameters: [
          {
            name: 'studentId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by student',
          },
          {
            name: 'teacherId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by teacher (resolved from charge association)',
          },
          {
            name: 'courseId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by course',
          },
          {
            name: 'classSessionId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by class session',
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['OPEN', 'PAID', 'CANCELLED'] },
            description: 'Charge status',
          },
          {
            name: 'currency',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['ARS', 'USD', 'EUR'] },
            description: 'Currency',
          },
        ],
        responses: {
          '200': { description: 'List', ...jsonSchema('ChargeListResponse') },
          '400': error('Invalid query'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Finance'],
        summary: 'Create charge',
        description:
          '`requirePermission(finance, create)`. Kind CLASS_SESSION or ENROLLMENT_PERIOD.',
        operationId: 'createCharge',
        security: session,
        requestBody: { required: true, ...jsonSchema('CreateChargeRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('ChargeResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Related entity not found'),
          '409': error('Conflict'),
        },
      },
    },

    '/finance/charges/{id}': {
      get: {
        tags: ['Finance'],
        summary: 'Get charge',
        description:
          'Ownership or `finance.read`. Out-of-scope id → 403 (IDOR-safe).',
        operationId: 'getCharge',
        security: session,
        parameters: [idParam('id', 'Charge id')],
        responses: {
          '200': { description: 'Charge', ...jsonSchema('ChargeResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/finance/payments': {
      get: {
        tags: ['Finance'],
        summary: 'List payments',
        description:
          'Auth required. `finance.read` (admin) → all; STUDENT/TEACHER → ownership scope. ' +
          'Optional filters: studentId, teacherId, chargeId, status, currency, provider.',
        operationId: 'listPayments',
        security: session,
        parameters: [
          {
            name: 'studentId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by student',
          },
          {
            name: 'teacherId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by teacher (via charge association)',
          },
          {
            name: 'chargeId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by charge',
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'],
            },
            description: 'Payment status',
          },
          {
            name: 'currency',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['ARS', 'USD', 'EUR'] },
            description: 'Currency',
          },
          {
            name: 'provider',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['MERCADOPAGO', 'STRIPE', 'MANUAL'],
            },
            description: 'Payment provider',
          },
        ],
        responses: {
          '200': { description: 'List', ...jsonSchema('PaymentListResponse') },
          '400': error('Invalid query'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Finance'],
        summary: 'Create payment',
        description:
          '`requirePermission(finance, create)`. Requires chargeId, provider, idempotencyKey. ' +
          'Optional providerPaymentId; otherwise stub provider creates a reference.',
        operationId: 'createPayment',
        security: session,
        requestBody: { required: true, ...jsonSchema('CreatePaymentRequest') },
        responses: {
          '201': { description: 'Created', ...jsonSchema('PaymentResponse') },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Charge not found'),
          '409': error('Conflict / idempotency'),
        },
      },
    },

    '/finance/payments/{id}': {
      get: {
        tags: ['Finance'],
        summary: 'Get payment',
        description:
          'Ownership or `finance.read`. Out-of-scope id → 403 (IDOR-safe).',
        operationId: 'getPayment',
        security: session,
        parameters: [idParam('id', 'Payment id')],
        responses: {
          '200': { description: 'Payment', ...jsonSchema('PaymentResponse') },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/finance/payments/{id}/succeed': {
      post: {
        tags: ['Finance'],
        summary: 'Mark MANUAL payment SUCCEEDED',
        description:
          '`requirePermission(finance, update)`. Only `provider=MANUAL`. ' +
          'Triggers Freeze: immutable RevenueAllocation with frozen academyPercentage. ' +
          'MERCADOPAGO/STRIPE must use webhooks.',
        operationId: 'succeedManualPayment',
        security: session,
        parameters: [idParam('id', 'Payment id')],
        responses: {
          '200': { description: 'Succeeded', ...jsonSchema('PaymentResponse') },
          '400': error('Not MANUAL / invalid transition'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Invalid transition / conflict'),
        },
      },
    },

    '/finance/payments/{id}/refunds': {
      post: {
        tags: ['Finance'],
        summary: 'Confirm total refund',
        description:
          '`requirePermission(finance, update)`. Total refund only (MVP). ' +
          'Creates REVERSAL allocation with negative minors.',
        operationId: 'createPaymentRefund',
        security: session,
        parameters: [idParam('id', 'Payment id')],
        requestBody: { required: true, ...jsonSchema('CreateRefundRequest') },
        responses: {
          '201': { description: 'Refunded', ...jsonSchema('RefundResponse') },
          '400': error('Invalid body / not refundable'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Conflict / already refunded'),
        },
      },
    },

    '/finance/allocations': {
      get: {
        tags: ['Finance'],
        summary: 'List revenue allocations',
        description:
          'Read-only immutable allocations. Ownership or `finance.read`. ' +
          'Optional filters: studentId, teacherId, paymentId, chargeId, kind, currency.',
        operationId: 'listRevenueAllocations',
        security: session,
        parameters: [
          {
            name: 'studentId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by student',
          },
          {
            name: 'teacherId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by teacher',
          },
          {
            name: 'paymentId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by payment',
          },
          {
            name: 'chargeId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by charge',
          },
          {
            name: 'kind',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['ORIGINAL', 'REVERSAL'] },
            description: 'Allocation kind',
          },
          {
            name: 'currency',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['ARS', 'USD', 'EUR'] },
            description: 'Currency',
          },
        ],
        responses: {
          '200': {
            description: 'List',
            ...jsonSchema('RevenueAllocationListResponse'),
          },
          '400': error('Invalid query'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/finance/allocations/{id}': {
      get: {
        tags: ['Finance'],
        summary: 'Get revenue allocation',
        description:
          'Read-only. Ownership or `finance.read`. Out-of-scope → 403.',
        operationId: 'getRevenueAllocation',
        security: session,
        parameters: [idParam('id', 'RevenueAllocation id')],
        responses: {
          '200': {
            description: 'Allocation',
            ...jsonSchema('RevenueAllocationResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/finance/settlements': {
      get: {
        tags: ['Finance'],
        summary: 'List teacher settlements',
        description:
          'Auth required. `finance.read` (admin) → all; TEACHER → own only; STUDENT → 403. ' +
          'Status is OPEN | MARKED_PAID (no OWED). Optional: teacherId, status, currency.',
        operationId: 'listTeacherSettlements',
        security: session,
        parameters: [
          {
            name: 'teacherId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Filter by teacher',
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['OPEN', 'MARKED_PAID'] },
            description: 'Settlement status (OPEN, not OWED)',
          },
          {
            name: 'currency',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['ARS', 'USD', 'EUR'] },
            description: 'Currency',
          },
        ],
        responses: {
          '200': {
            description: 'List',
            ...jsonSchema('TeacherSettlementListResponse'),
          },
          '400': error('Invalid query'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['Finance'],
        summary: 'Create teacher settlement',
        description:
          '`requirePermission(finance, create)`. Creates settlement in status OPEN.',
        operationId: 'createTeacherSettlement',
        security: session,
        requestBody: {
          required: true,
          ...jsonSchema('CreateTeacherSettlementRequest'),
        },
        responses: {
          '201': {
            description: 'Created',
            ...jsonSchema('TeacherSettlementResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Teacher not found'),
          '409': error('Conflict'),
        },
      },
    },

    '/finance/settlements/{id}': {
      get: {
        tags: ['Finance'],
        summary: 'Get teacher settlement',
        description:
          '`finance.read` or owning TEACHER. STUDENT → 403. Status OPEN | MARKED_PAID.',
        operationId: 'getTeacherSettlement',
        security: session,
        parameters: [idParam('id', 'TeacherSettlement id')],
        responses: {
          '200': {
            description: 'Settlement',
            ...jsonSchema('TeacherSettlementResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/finance/settlements/{id}/mark-paid': {
      post: {
        tags: ['Finance'],
        summary: 'Mark settlement paid',
        description:
          '`requirePermission(finance, update)`. Transition OPEN → MARKED_PAID only.',
        operationId: 'markTeacherSettlementPaid',
        security: session,
        parameters: [idParam('id', 'TeacherSettlement id')],
        requestBody: {
          required: true,
          ...jsonSchema('MarkTeacherSettlementPaidRequest'),
        },
        responses: {
          '200': {
            description: 'Marked paid',
            ...jsonSchema('TeacherSettlementResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Invalid transition / conflict'),
        },
      },
    },

    '/finance/webhooks/mercado-pago': {
      post: {
        tags: ['Finance'],
        summary: 'Mercado Pago webhook',
        description:
          'No session auth. Idempotent inbox via providerEventId. ' +
          'Signature verified when Mercado Pago webhook secret is set; otherwise accepted for stub/dev.',
        operationId: 'mercadoPagoWebhook',
        requestBody: {
          required: true,
          ...jsonSchema('FinanceWebhookRequest'),
        },
        responses: {
          '200': {
            description: 'Received',
            ...jsonSchema('FinanceWebhookResponse'),
          },
          '400': error('Invalid body'),
          '409': error('Conflict'),
        },
      },
    },

    '/finance/webhooks/stripe': {
      post: {
        tags: ['Finance'],
        summary: 'Stripe webhook',
        description:
          'No session auth. Idempotent inbox via providerEventId. ' +
          'Signature verified when Stripe webhook secret is set; otherwise accepted for stub/dev.',
        operationId: 'stripeWebhook',
        requestBody: {
          required: true,
          ...jsonSchema('FinanceWebhookRequest'),
        },
        responses: {
          '200': {
            description: 'Received',
            ...jsonSchema('FinanceWebhookResponse'),
          },
          '400': error('Invalid body'),
          '409': error('Conflict'),
        },
      },
    },

    '/public/online-courses': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'Public online course catalogue',
        description:
          'No auth. Returns PUBLISHED + isActive courses only (card shape; no private asset URLs).',
        operationId: 'listPublicOnlineCourses',
        responses: {
          '200': {
            description: 'Catalogue',
            ...jsonSchema('PublicOnlineCourseListResponse'),
          },
        },
      },
    },

    '/public/online-courses/{slug}': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'Public online course landing',
        description:
          'No auth. Outline with titles + asset kinds only. Optional hasAccess when session present.',
        operationId: 'getPublicOnlineCourse',
        parameters: [idParam('slug', 'Course slug', 'string')],
        responses: {
          '200': {
            description: 'Course landing',
            ...jsonSchema('PublicOnlineCourseResponse'),
          },
          '404': error('Not found or not published'),
        },
      },
    },

    '/online-courses': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'List online courses (admin)',
        description: '`requirePermission(online_courses, read)`.',
        operationId: 'listOnlineCourses',
        security: session,
        responses: {
          '200': {
            description: 'List',
            ...jsonSchema('OnlineCourseListResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
      post: {
        tags: ['OnlineCourses'],
        summary: 'Create online course',
        description: '`requirePermission(online_courses, create)`. Starts as DRAFT.',
        operationId: 'createOnlineCourse',
        security: session,
        requestBody: {
          required: true,
          ...jsonSchema('CreateOnlineCourseRequest'),
        },
        responses: {
          '201': {
            description: 'Created',
            ...jsonSchema('OnlineCourseResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '409': error('Slug conflict'),
        },
      },
    },

    '/online-courses/{id}': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'Get online course',
        description: '`requirePermission(online_courses, read)`.',
        operationId: 'getOnlineCourse',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        responses: {
          '200': {
            description: 'Course',
            ...jsonSchema('OnlineCourseResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      patch: {
        tags: ['OnlineCourses'],
        summary: 'Update online course',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'updateOnlineCourse',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        requestBody: {
          required: true,
          ...jsonSchema('UpdateOnlineCourseRequest'),
        },
        responses: {
          '200': {
            description: 'Updated',
            ...jsonSchema('OnlineCourseResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Slug conflict'),
        },
      },
      delete: {
        tags: ['OnlineCourses'],
        summary: 'Soft-delete online course',
        description:
          '`requirePermission(online_courses, delete)`. Sets isActive=false.',
        operationId: 'deleteOnlineCourse',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        responses: {
          '200': {
            description: 'Soft-deleted',
            ...jsonSchema('OnlineCourseResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{id}/publish': {
      post: {
        tags: ['OnlineCourses'],
        summary: 'Publish online course',
        description: '`requirePermission(online_courses, update)`. status → PUBLISHED.',
        operationId: 'publishOnlineCourse',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        responses: {
          '200': {
            description: 'Published',
            ...jsonSchema('OnlineCourseResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{id}/unpublish': {
      post: {
        tags: ['OnlineCourses'],
        summary: 'Unpublish online course',
        description: '`requirePermission(online_courses, update)`. status → DRAFT.',
        operationId: 'unpublishOnlineCourse',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        responses: {
          '200': {
            description: 'Unpublished',
            ...jsonSchema('OnlineCourseResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{id}/archive': {
      post: {
        tags: ['OnlineCourses'],
        summary: 'Archive online course',
        description: '`requirePermission(online_courses, update)`. status → ARCHIVED.',
        operationId: 'archiveOnlineCourse',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        responses: {
          '200': {
            description: 'Archived',
            ...jsonSchema('OnlineCourseResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{id}/preview': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'Preview student outline',
        description:
          '`requirePermission(online_courses, read)`. Student-like outline without granting access.',
        operationId: 'previewOnlineCourse',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        responses: {
          '200': {
            description: 'Outline',
            ...jsonSchema('StudentOnlineCourseOutline'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{id}/modules': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'List modules',
        description: '`requirePermission(online_courses, read)`.',
        operationId: 'listOnlineCourseModules',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        responses: {
          '200': {
            description: 'Modules',
            ...jsonSchema('OnlineCourseModuleListResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      post: {
        tags: ['OnlineCourses'],
        summary: 'Create module',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'createOnlineCourseModule',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        requestBody: {
          required: true,
          ...jsonSchema('CreateOnlineCourseModuleRequest'),
        },
        responses: {
          '201': {
            description: 'Created',
            ...jsonSchema('OnlineCourseModuleResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{id}/modules/reorder': {
      post: {
        tags: ['OnlineCourses'],
        summary: 'Reorder modules',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'reorderOnlineCourseModules',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        requestBody: {
          required: true,
          ...jsonSchema('ReorderOnlineCourseModulesRequest'),
        },
        responses: {
          '200': {
            description: 'Reordered',
            ...jsonSchema('OnlineCourseModuleListResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{courseId}/modules/{moduleId}': {
      patch: {
        tags: ['OnlineCourses'],
        summary: 'Update module',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'updateOnlineCourseModule',
        security: session,
        parameters: [
          idParam('courseId', 'OnlineCourse id'),
          idParam('moduleId', 'Module id'),
        ],
        requestBody: {
          required: true,
          ...jsonSchema('UpdateOnlineCourseModuleRequest'),
        },
        responses: {
          '200': {
            description: 'Updated',
            ...jsonSchema('OnlineCourseModuleResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{courseId}/modules/{moduleId}/lessons': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'List lessons',
        description: '`requirePermission(online_courses, read)`.',
        operationId: 'listOnlineLessons',
        security: session,
        parameters: [
          idParam('courseId', 'OnlineCourse id'),
          idParam('moduleId', 'Module id'),
        ],
        responses: {
          '200': {
            description: 'Lessons',
            ...jsonSchema('OnlineLessonListResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      post: {
        tags: ['OnlineCourses'],
        summary: 'Create lesson',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'createOnlineLesson',
        security: session,
        parameters: [
          idParam('courseId', 'OnlineCourse id'),
          idParam('moduleId', 'Module id'),
        ],
        requestBody: {
          required: true,
          ...jsonSchema('CreateOnlineLessonRequest'),
        },
        responses: {
          '201': {
            description: 'Created',
            ...jsonSchema('OnlineLessonResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{courseId}/modules/{moduleId}/lessons/reorder': {
      post: {
        tags: ['OnlineCourses'],
        summary: 'Reorder lessons',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'reorderOnlineLessons',
        security: session,
        parameters: [
          idParam('courseId', 'OnlineCourse id'),
          idParam('moduleId', 'Module id'),
        ],
        requestBody: {
          required: true,
          ...jsonSchema('ReorderOnlineLessonsRequest'),
        },
        responses: {
          '200': {
            description: 'Reordered',
            ...jsonSchema('OnlineLessonListResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{courseId}/modules/{moduleId}/lessons/{lessonId}': {
      patch: {
        tags: ['OnlineCourses'],
        summary: 'Update lesson',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'updateOnlineLesson',
        security: session,
        parameters: [
          idParam('courseId', 'OnlineCourse id'),
          idParam('moduleId', 'Module id'),
          idParam('lessonId', 'Lesson id'),
        ],
        requestBody: {
          required: true,
          ...jsonSchema('UpdateOnlineLessonRequest'),
        },
        responses: {
          '200': {
            description: 'Updated',
            ...jsonSchema('OnlineLessonResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/lessons/{lessonId}/assets': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'List lesson assets',
        description: '`requirePermission(online_courses, read)`.',
        operationId: 'listOnlineLessonAssets',
        security: session,
        parameters: [idParam('lessonId', 'Lesson id')],
        responses: {
          '200': {
            description: 'Assets',
            ...jsonSchema('OnlineLessonAssetListResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      post: {
        tags: ['OnlineCourses'],
        summary: 'Create TEXT/LINK/VIDEO asset',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'createOnlineLessonAsset',
        security: session,
        parameters: [idParam('lessonId', 'Lesson id')],
        requestBody: {
          required: true,
          ...jsonSchema('CreateOnlineLessonAssetRequest'),
        },
        responses: {
          '201': {
            description: 'Created',
            ...jsonSchema('OnlineLessonAssetResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/lessons/{lessonId}/assets/uploads': {
      post: {
        tags: ['OnlineCourses'],
        summary: 'DOCUMENT upload intent',
        description:
          '`requirePermission(online_courses, update)`. Returns PENDING asset + presigned PUT.',
        operationId: 'createOnlineLessonAssetUpload',
        security: session,
        parameters: [idParam('lessonId', 'Lesson id')],
        requestBody: {
          required: true,
          ...jsonSchema('CreateOnlineLessonAssetUploadRequest'),
        },
        responses: {
          '201': {
            description: 'Upload intent',
            ...jsonSchema('OnlineLessonAssetUploadResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/assets/{assetId}/complete': {
      post: {
        tags: ['OnlineCourses'],
        summary: 'Complete DOCUMENT upload',
        description: '`requirePermission(online_courses, update)`. Verify object → READY.',
        operationId: 'completeOnlineLessonAssetUpload',
        security: session,
        parameters: [idParam('assetId', 'Asset id')],
        responses: {
          '200': {
            description: 'Ready',
            ...jsonSchema('OnlineLessonAssetResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
          '409': error('Invalid state'),
        },
      },
    },

    '/online-courses/assets/{assetId}': {
      patch: {
        tags: ['OnlineCourses'],
        summary: 'Update asset metadata',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'updateOnlineLessonAsset',
        security: session,
        parameters: [idParam('assetId', 'Asset id')],
        requestBody: {
          required: true,
          ...jsonSchema('UpdateOnlineLessonAssetRequest'),
        },
        responses: {
          '200': {
            description: 'Updated',
            ...jsonSchema('OnlineLessonAssetResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      delete: {
        tags: ['OnlineCourses'],
        summary: 'Soft-delete asset',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'deleteOnlineLessonAsset',
        security: session,
        parameters: [idParam('assetId', 'Asset id')],
        responses: {
          '204': { description: 'Soft-deleted' },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/assets/{assetId}/download': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'Admin asset download',
        description: '`requirePermission(online_courses, read)`. Signed GET or externalUrl.',
        operationId: 'downloadOnlineLessonAssetAdmin',
        security: session,
        parameters: [idParam('assetId', 'Asset id')],
        responses: {
          '200': {
            description: 'Download ref',
            ...jsonSchema('OnlineLessonAssetDownloadResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/lessons/{lessonId}/quiz': {
      get: {
        tags: ['OnlineCourses'],
        summary: 'Get quiz (admin)',
        description: '`requirePermission(online_courses, read)`. Includes correct answers.',
        operationId: 'getOnlineLessonQuizAdmin',
        security: session,
        parameters: [idParam('lessonId', 'Lesson id')],
        responses: {
          '200': {
            description: 'Quiz',
            ...jsonSchema('OnlineQuizAdminResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      put: {
        tags: ['OnlineCourses'],
        summary: 'Upsert quiz (admin)',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'upsertOnlineLessonQuiz',
        security: session,
        parameters: [idParam('lessonId', 'Lesson id')],
        requestBody: {
          required: true,
          ...jsonSchema('UpsertOnlineQuizRequest'),
        },
        responses: {
          '200': {
            description: 'Upserted',
            ...jsonSchema('OnlineQuizAdminResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{id}/access': {
      post: {
        tags: ['OnlineCourses'],
        summary: 'Grant student access',
        description: '`requirePermission(online_courses, update)`.',
        operationId: 'grantOnlineCourseAccess',
        security: session,
        parameters: [idParam('id', 'OnlineCourse id')],
        requestBody: {
          required: true,
          ...jsonSchema('GrantOnlineCourseAccessRequest'),
        },
        responses: {
          '201': {
            description: 'Granted',
            ...jsonSchema('OnlineCourseAccessResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/online-courses/{id}/access/{studentId}': {
      delete: {
        tags: ['OnlineCourses'],
        summary: 'Revoke student access',
        description: '`requirePermission(online_courses, update)`. Soft-revokes access.',
        operationId: 'revokeOnlineCourseAccess',
        security: session,
        parameters: [
          idParam('id', 'OnlineCourse id'),
          idParam('studentId', 'Student id'),
        ],
        responses: {
          '200': {
            description: 'Revoked',
            ...jsonSchema('OnlineCourseAccessResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/students/me/online-courses': {
      get: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'My enrolled online courses',
        description: 'Session STUDENT. Published courses with active access.',
        operationId: 'listMyOnlineCourses',
        security: session,
        responses: {
          '200': {
            description: 'List',
            ...jsonSchema('OnlineCourseListResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
        },
      },
    },

    '/students/me/online-courses/{slug}': {
      get: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'My course outline + progress',
        description: 'Session STUDENT with active access. Includes LINEAR locks.',
        operationId: 'getMyOnlineCourseOutline',
        security: session,
        parameters: [idParam('slug', 'Course slug', 'string')],
        responses: {
          '200': {
            description: 'Outline',
            ...jsonSchema('StudentOnlineCourseOutline'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden / no access'),
          '404': error('Not found'),
        },
      },
    },

    '/students/me/online-courses/{slug}/enroll-free': {
      post: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'Free enroll',
        description:
          'Session STUDENT. Only free published courses (no Charge/Payment).',
        operationId: 'enrollFreeOnlineCourse',
        security: session,
        parameters: [idParam('slug', 'Course slug', 'string')],
        responses: {
          '201': {
            description: 'Enrolled',
            ...jsonSchema('OnlineCourseAccessResponse'),
          },
          '400': error('Not free / not published'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/students/me/online-courses/{slug}/lessons/{lessonId}': {
      get: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'Lesson content',
        description: 'Session STUDENT with access. 403 if LINEAR-locked.',
        operationId: 'getMyOnlineLesson',
        security: session,
        parameters: [
          idParam('slug', 'Course slug', 'string'),
          idParam('lessonId', 'Lesson id'),
        ],
        responses: {
          '200': {
            description: 'Lesson detail',
            ...jsonSchema('StudentOnlineLessonDetail'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden / locked'),
          '404': error('Not found'),
        },
      },
    },

    '/students/me/online-courses/{slug}/lessons/{lessonId}/progress': {
      post: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'Update lesson progress',
        description: 'Session STUDENT. status IN_PROGRESS | COMPLETED.',
        operationId: 'updateMyOnlineLessonProgress',
        security: session,
        parameters: [
          idParam('slug', 'Course slug', 'string'),
          idParam('lessonId', 'Lesson id'),
        ],
        requestBody: {
          required: true,
          ...jsonSchema('UpdateOnlineLessonProgressRequest'),
        },
        responses: {
          '200': {
            description: 'Progress',
            ...jsonSchema('OnlineLessonProgressResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/students/me/online-courses/{slug}/lessons/{lessonId}/quiz': {
      get: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'Get quiz (student)',
        description: 'Session STUDENT. Public quiz (no correct answers).',
        operationId: 'getMyOnlineLessonQuiz',
        security: session,
        parameters: [
          idParam('slug', 'Course slug', 'string'),
          idParam('lessonId', 'Lesson id'),
        ],
        responses: {
          '200': {
            description: 'Quiz',
            ...jsonSchema('OnlineQuizPublicResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/students/me/online-courses/{slug}/lessons/{lessonId}/quiz/submit': {
      post: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'Submit quiz attempt',
        description: 'Session STUDENT.',
        operationId: 'submitMyOnlineLessonQuiz',
        security: session,
        parameters: [
          idParam('slug', 'Course slug', 'string'),
          idParam('lessonId', 'Lesson id'),
        ],
        requestBody: {
          required: true,
          ...jsonSchema('SubmitOnlineQuizRequest'),
        },
        responses: {
          '200': {
            description: 'Result',
            ...jsonSchema('OnlineQuizAttemptResult'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/students/me/online-courses/{slug}/lessons/{lessonId}/submissions': {
      get: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'List my submissions',
        description: 'Session STUDENT. Own text submissions only.',
        operationId: 'listMyOnlineLessonSubmissions',
        security: session,
        parameters: [
          idParam('slug', 'Course slug', 'string'),
          idParam('lessonId', 'Lesson id'),
        ],
        responses: {
          '200': {
            description: 'Submissions',
            ...jsonSchema('OnlineLessonSubmissionListResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
      post: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'Create submission',
        description: 'Session STUDENT.',
        operationId: 'createMyOnlineLessonSubmission',
        security: session,
        parameters: [
          idParam('slug', 'Course slug', 'string'),
          idParam('lessonId', 'Lesson id'),
        ],
        requestBody: {
          required: true,
          ...jsonSchema('CreateOnlineLessonSubmissionRequest'),
        },
        responses: {
          '201': {
            description: 'Created',
            ...jsonSchema('OnlineLessonSubmissionResponse'),
          },
          '400': error('Invalid body'),
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },

    '/students/me/online-courses/assets/{assetId}/download': {
      get: {
        tags: ['OnlineCourses', 'StudentHub'],
        summary: 'Student asset download',
        description: 'Session STUDENT with entitled access. Signed GET or externalUrl.',
        operationId: 'downloadMyOnlineLessonAsset',
        security: session,
        parameters: [idParam('assetId', 'Asset id')],
        responses: {
          '200': {
            description: 'Download ref',
            ...jsonSchema('OnlineLessonAssetDownloadResponse'),
          },
          '401': error('Unauthenticated'),
          '403': error('Forbidden'),
          '404': error('Not found'),
        },
      },
    },
  };
}
