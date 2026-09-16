import type { Express } from 'express';
import type { PermissionRef, Role, Weekday } from '@academia/shared';
import { DEFAULT_ACADEMY_TIMEZONE } from '@academia/shared';
import type { PermissionGrantStore } from '../domain/authorization/has-permission.js';
import type { AdministrativePermissionStore } from '../domain/authorization/manage-administrative-permissions.js';
import type {
  PermissionChangeAuditEntry,
  PermissionChangeAuditStore,
} from '../domain/authorization/permission-change-audit.js';
import { createInMemoryStudentStore } from '../domain/students/in-memory-student-store.js';
import type { InMemoryStudentStore } from '../domain/students/in-memory-student-store.js';
import { createInMemoryTeacherStore } from '../domain/teachers/in-memory-teacher-store.js';
import type { InMemoryTeacherStore } from '../domain/teachers/in-memory-teacher-store.js';
import { createInMemoryTeacherAssignmentStore } from '../domain/assignments/in-memory-assignment-store.js';
import type { TeacherAssignmentStore } from '../domain/assignments/assignment-service.js';
import { createInMemoryCourseStore } from '../domain/courses/in-memory-course-store.js';
import type { InMemoryCourseStore } from '../domain/courses/in-memory-course-store.js';
import { createInMemoryGroupStore } from '../domain/groups/in-memory-group-store.js';
import type { InMemoryGroupStore } from '../domain/groups/in-memory-group-store.js';
import { createInMemoryEnrollmentStore } from '../domain/enrollments/in-memory-enrollment-store.js';
import type { InMemoryEnrollmentStore } from '../domain/enrollments/in-memory-enrollment-store.js';
import { createInMemoryScheduleOptionStore } from '../domain/schedules/in-memory-schedule-option-store.js';
import type { InMemoryScheduleOptionStore } from '../domain/schedules/in-memory-schedule-option-store.js';
import { createInMemoryClassSessionStore } from '../domain/classes/in-memory-class-session-store.js';
import type { InMemoryClassSessionStore } from '../domain/classes/in-memory-class-session-store.js';
import { createInMemoryAttendanceStore } from '../domain/attendance/in-memory-attendance-store.js';
import type { InMemoryAttendanceStore } from '../domain/attendance/in-memory-attendance-store.js';
import { createInMemoryClassNoteStore } from '../domain/class-notes/in-memory-class-note-store.js';
import type { InMemoryClassNoteStore } from '../domain/class-notes/in-memory-class-note-store.js';
import { createAuthService } from '../domain/identity/auth-service.js';
import type {
  ProvisionIdentityRecord,
  RoleProvisionStore,
} from '../domain/identity/provision-role.js';
import { createSessionCodec } from '../domain/identity/session.js';
import { normalizeEmail } from '../domain/identity/user-repository.js';
import { createApp } from '../http/app.js';
import { createLogger } from '../lib/logger.js';
import { hashPassword } from '../lib/password.js';
import {
  createInMemoryUserRepository,
  type InMemoryUserRepository,
} from './in-memory-user-repository.js';

export const TEST_SECRET = 'integration-test-secret-long-enough-32ch';
export const SESSION_COOKIE = 'academia_session';

export interface TestAppOptions {
  databaseReachable?: boolean;
  configurationIssues?: string[];
  docsEnabled?: boolean;
}

export interface InMemoryRoleProvisionStore extends RoleProvisionStore {
  seed(record: ProvisionIdentityRecord & { passwordHash: string }): void;
  passwordHashes(): Map<string, string>;
}

export interface InMemoryAdministrativePermissionStore
  extends AdministrativePermissionStore {
  clear(): void;
  /**
   * Lookup used by requirePermission. ADMINISTRATIVE grants use `grant()`;
   * other roles can receive temporary grants via `grantRole()` in tests.
   */
  asPermissionGrantStore(): PermissionGrantStore;
  grantRole(
    role: Role,
    module: PermissionRef['module'],
    action: PermissionRef['action'],
  ): void;
}

export interface InMemoryPermissionChangeAuditStore
  extends PermissionChangeAuditStore {
  entries(): readonly PermissionChangeAuditEntry[];
  clear(): void;
}

export interface TestApp {
  app: Express;
  users: InMemoryUserRepository;
  directors: InMemoryRoleProvisionStore;
  administratives: InMemoryRoleProvisionStore;
  teachers: InMemoryRoleProvisionStore;
  students: InMemoryRoleProvisionStore;
  studentRegistry: InMemoryStudentStore;
  teacherRegistry: InMemoryTeacherStore;
  assignments: TeacherAssignmentStore;
  courses: InMemoryCourseStore;
  groups: InMemoryGroupStore;
  enrollments: InMemoryEnrollmentStore;
  scheduleOptions: InMemoryScheduleOptionStore;
  classSessions: InMemoryClassSessionStore;
  attendances: InMemoryAttendanceStore;
  classNotes: InMemoryClassNoteStore;
  administrativePermissions: InMemoryAdministrativePermissionStore;
  permissionChangeAudits: InMemoryPermissionChangeAuditStore;
}

function permissionKey(module: string, action: string): string {
  return `${module}:${action}`;
}

function createInMemoryPermissionChangeAuditStore(): InMemoryPermissionChangeAuditStore {
  const entries: PermissionChangeAuditEntry[] = [];

  return {
    entries() {
      return entries;
    },
    clear() {
      entries.length = 0;
    },
    async append(entry) {
      entries.push({ ...entry });
    },
  };
}

function createInMemoryAdministrativePermissionStore(): InMemoryAdministrativePermissionStore {
  const grants = new Set<string>();
  const roleGrants = new Map<Role, Set<string>>();

  return {
    clear() {
      grants.clear();
      roleGrants.clear();
    },

    asPermissionGrantStore() {
      return {
        async roleOwns(role, module, action) {
          const key = permissionKey(module, action);
          if (role === 'ADMINISTRATIVE' && grants.has(key)) {
            return true;
          }
          return roleGrants.get(role)?.has(key) ?? false;
        },
      };
    },

    grantRole(role, module, action) {
      let set = roleGrants.get(role);
      if (!set) {
        set = new Set();
        roleGrants.set(role, set);
      }
      set.add(permissionKey(module, action));
    },

    async listGranted() {
      const permissions: PermissionRef[] = [...grants].map((entry) => {
        const [module, action] = entry.split(':') as [
          PermissionRef['module'],
          PermissionRef['action'],
        ];
        return { module, action };
      });
      return permissions.sort((a, b) =>
        a.module === b.module
          ? a.action.localeCompare(b.action)
          : a.module.localeCompare(b.module),
      );
    },

    async grant(module, action) {
      const key = permissionKey(module, action);
      if (grants.has(key)) {
        return 'exists';
      }
      grants.add(key);
      return 'created';
    },

    async revoke(module, action) {
      const key = permissionKey(module, action);
      if (!grants.has(key)) {
        return 'missing';
      }
      grants.delete(key);
      return 'removed';
    },
  };
}

function createInMemoryRoleProvisionStore(
  users: InMemoryUserRepository,
  role: Role,
): InMemoryRoleProvisionStore {
  const records = new Map<string, ProvisionIdentityRecord>();
  const hashes = new Map<string, string>();
  let seq = 0;

  return {
    seed(record) {
      const email = normalizeEmail(record.email);
      records.set(email, { ...record, email });
      hashes.set(email, record.passwordHash);
      users.seed({
        id: record.id,
        email,
        name: record.name,
        role: record.role,
        isActive: record.isActive,
        passwordHash: record.passwordHash,
      });
    },

    passwordHashes() {
      return hashes;
    },

    async findByEmail(email) {
      return records.get(normalizeEmail(email)) ?? null;
    },

    async create({ email, name, passwordHash }) {
      const normalized = normalizeEmail(email);
      seq += 1;
      const record: ProvisionIdentityRecord = {
        id: `${role.toLowerCase()}-${seq}`,
        email: normalized,
        name,
        role,
        isActive: true,
      };
      records.set(normalized, record);
      hashes.set(normalized, passwordHash);
      users.seed({ ...record, passwordHash });
      return { ...record };
    },

    async reassertActive(id) {
      for (const [email, record] of records) {
        if (record.id !== id) continue;
        const updated = { ...record, role, isActive: true };
        records.set(email, updated);
        const hash = hashes.get(email);
        if (hash) users.seed({ ...updated, passwordHash: hash });
        return { ...updated };
      }
      throw new Error(`${role} ${id} not found`);
    },
  };
}

/**
 * Builds the real Express stack over test doubles, so route tests cover the
 * actual middleware chain (logging, CORS, validation, error handling) rather
 * than a hand-rolled approximation.
 */
export async function buildTestApp({
  databaseReachable = true,
  configurationIssues = [],
  docsEnabled = true,
}: TestAppOptions = {}): Promise<TestApp> {
  const users = createInMemoryUserRepository();
  const directors = createInMemoryRoleProvisionStore(users, 'DIRECTOR');
  const administratives = createInMemoryRoleProvisionStore(users, 'ADMINISTRATIVE');
  const teachers = createInMemoryRoleProvisionStore(users, 'TEACHER');
  const students = createInMemoryRoleProvisionStore(users, 'STUDENT');
  const administrativePermissions = createInMemoryAdministrativePermissionStore();
  const permissionGrants = administrativePermissions.asPermissionGrantStore();
  const permissionChangeAudits = createInMemoryPermissionChangeAuditStore();
  let userSeq = 0;
  const userBridge = {
    findUserByEmail(email: string) {
      const user = users.getByEmailSync(email);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      };
    },
    findUserById(id: string) {
      const user = users.getByIdSync(id);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      };
    },
    createUser(input: {
      email: string;
      name: string;
      passwordHash: string;
      role: Role;
      isActive: boolean;
    }) {
      userSeq += 1;
      const created = {
        id: `registry-user-${userSeq}`,
        email: normalizeEmail(input.email),
        name: input.name,
        role: input.role,
        isActive: input.isActive,
        passwordHash: input.passwordHash,
      };
      users.upsert(created);
      return {
        id: created.id,
        email: created.email,
        role: created.role,
        isActive: created.isActive,
      };
    },
    updateUser(id: string, patch: { name?: string; isActive?: boolean }) {
      users.patch(id, patch);
    },
  };
  const studentRegistry = createInMemoryStudentStore(userBridge);
  const teacherRegistry = createInMemoryTeacherStore(userBridge);
  const assignmentMemory = createInMemoryTeacherAssignmentStore();
  const assignments: TeacherAssignmentStore = {
    findByStudentId: (studentId) => assignmentMemory.findByStudentId(studentId),
    upsert: (studentId, teacherId) =>
      assignmentMemory.upsert(studentId, teacherId),
    deleteByStudentId: (studentId) =>
      assignmentMemory.deleteByStudentId(studentId),
    async findStudent(id) {
      const row = await studentRegistry.findById(id);
      return row
        ? { id: row.id, userId: row.userId, isActive: row.isActive }
        : null;
    },
    async findTeacher(id) {
      const row = await teacherRegistry.findById(id);
      return row
        ? { id: row.id, userId: row.userId, isActive: row.isActive }
        : null;
    },
  };
  const courses = createInMemoryCourseStore();
  const scheduleOptions = createInMemoryScheduleOptionStore();
  const groups = createInMemoryGroupStore({
    findCourse: async (id) => {
      const row = await courses.findById(id);
      return row ? { id: row.id, isActive: row.isActive } : null;
    },
    findTeacher: async (id) => {
      const row = await teacherRegistry.findById(id);
      return row ? { id: row.id, isActive: row.isActive } : null;
    },
    findScheduleOption: async (id) => {
      const row = await scheduleOptions.findById(id);
      return row ? { id: row.id, isActive: row.isActive } : null;
    },
  });
  const enrollments = createInMemoryEnrollmentStore({
    findGroup: async (id) => {
      const row = await groups.findById(id);
      return row ? { id: row.id, isActive: row.isActive } : null;
    },
    findStudent: async (id) => {
      const row = await studentRegistry.findById(id);
      return row ? { id: row.id, isActive: row.isActive } : null;
    },
  });
  const classSessions = createInMemoryClassSessionStore({
    findGroupContext: async (groupId) => {
      const group = await groups.findById(groupId);
      if (!group) return null;
      const course = await courses.findById(group.courseId);
      if (!course) return null;
      let scheduleOptionActive: boolean | null = null;
      let scheduleDay: Weekday | null = null;
      let scheduleStartTime: string | null = null;
      if (group.scheduleOptionId) {
        const option = await scheduleOptions.findById(group.scheduleOptionId);
        scheduleOptionActive = option ? option.isActive : null;
        scheduleDay = option?.day ?? null;
        scheduleStartTime = option?.startTime ?? null;
      }
      return {
        id: group.id,
        isActive: group.isActive,
        teacherId: group.teacherId,
        scheduleOptionId: group.scheduleOptionId,
        serviceType: course.serviceType,
        courseIsActive: course.isActive,
        scheduleOptionActive,
        scheduleDay,
        scheduleStartTime,
      };
    },
    resolveCalendarMeta: async (groupId) => {
      const group = await groups.findById(groupId);
      if (!group) return null;
      const course = await courses.findById(group.courseId);
      if (!course) return null;
      let teacher: {
        id: string;
        firstName: string;
        lastName: string;
      } | null = null;
      if (group.teacherId) {
        const row = await teacherRegistry.findById(group.teacherId);
        if (row) {
          teacher = {
            id: row.id,
            firstName: row.firstName,
            lastName: row.lastName,
          };
        }
      }
      return {
        name: group.name,
        course: {
          id: course.id,
          name: course.name,
          serviceType: course.serviceType,
          courseType: course.courseType,
        },
        teacher,
      };
    },
    hasActiveEnrollment: async (groupId, studentId) => {
      const row = await enrollments.findByGroupAndStudent(groupId, studentId);
      return row?.isActive === true;
    },
  });
  const attendances = createInMemoryAttendanceStore({
    findClassSession: async (id) => {
      const session = await classSessions.findById(id);
      if (!session) return null;
      const group = await groups.findById(session.groupId);
      return {
        id: session.id,
        groupId: session.groupId,
        isActive: session.isActive,
        teacherId: group?.teacherId ?? null,
      };
    },
    findStudent: async (id) => {
      const row = await studentRegistry.findById(id);
      if (!row) return null;
      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        isActive: row.isActive,
      };
    },
    hasActiveEnrollment: async (groupId, studentId) => {
      const row = await enrollments.findByGroupAndStudent(groupId, studentId);
      return row?.isActive === true;
    },
  });
  const classNotes = createInMemoryClassNoteStore({
    findClassSession: async (id) => {
      const session = await classSessions.findById(id);
      if (!session) return null;
      const group = await groups.findById(session.groupId);
      return {
        id: session.id,
        groupId: session.groupId,
        isActive: session.isActive,
        teacherId: group?.teacherId ?? null,
      };
    },
  });
  const authService = createAuthService(users);
  const sessionCodec = createSessionCodec(TEST_SECRET, 3600);

  const authOptions = {
    authService,
    sessionCodec,
    cookieName: SESSION_COOKIE,
  };

  const app = createApp({
    logger: createLogger({ level: 'silent' }),
    allowedOrigins: [],
    health: {
      environment: 'test',
      isDatabaseReachable: async () => databaseReachable,
      configurationIssues: () => configurationIssues,
      uptimeSeconds: () => 1,
    },
    auth: {
      authService,
      sessionCodec,
      cookie: { name: SESSION_COOKIE, secure: false, ttlSeconds: 3600 },
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
      students: studentRegistry,
      permissionGrants,
    },
    teacherRegistry: {
      authenticate: authOptions,
      teachers: teacherRegistry,
      permissionGrants,
    },
    studentTeacherAssignment: {
      authenticate: authOptions,
      assignments,
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
      academy: { businessTimezone: DEFAULT_ACADEMY_TIMEZONE },
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
      teachers: teacherRegistry,
      students: studentRegistry,
      academy: { businessTimezone: DEFAULT_ACADEMY_TIMEZONE },
      permissionGrants,
    },
    administrativePermissions: {
      authenticate: authOptions,
      administrativePermissions,
      permissionGrants,
      permissionChangeAudits,
    },
    docsEnabled,
  });

  return {
    app,
    users,
    directors,
    administratives,
    teachers,
    students,
    studentRegistry,
    teacherRegistry,
    assignments,
    courses,
    groups,
    enrollments,
    scheduleOptions,
    classSessions,
    attendances,
    classNotes,
    administrativePermissions,
    permissionChangeAudits,
  };
}


export async function seedUser(
  users: InMemoryUserRepository,
  overrides: Partial<Parameters<InMemoryUserRepository['seed']>[0]> & {
    password: string;
  },
): Promise<void> {
  const { password, ...rest } = overrides;

  users.seed({
    id: 'user-1',
    email: 'directora@academia.test',
    name: 'Directora',
    role: 'DIRECTOR',
    isActive: true,
    passwordHash: await hashPassword(password),
    ...rest,
  });
}

/** Extracts a Set-Cookie value by name from a supertest response. */
export function cookieFrom(
  header: string | string[] | undefined,
  name: string,
): string | undefined {
  const list = Array.isArray(header) ? header : header ? [header] : [];
  return list.find((entry) => entry.startsWith(`${name}=`));
}
