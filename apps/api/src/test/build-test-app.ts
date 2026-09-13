import type { Express } from 'express';
import type { PermissionRef, Role } from '@academia/shared';
import type { AdministrativePermissionStore } from '../domain/authorization/manage-administrative-permissions.js';
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
}

export interface InMemoryRoleProvisionStore extends RoleProvisionStore {
  seed(record: ProvisionIdentityRecord & { passwordHash: string }): void;
  passwordHashes(): Map<string, string>;
}

export interface InMemoryAdministrativePermissionStore
  extends AdministrativePermissionStore {
  clear(): void;
}

export interface TestApp {
  app: Express;
  users: InMemoryUserRepository;
  directors: InMemoryRoleProvisionStore;
  administratives: InMemoryRoleProvisionStore;
  teachers: InMemoryRoleProvisionStore;
  students: InMemoryRoleProvisionStore;
  administrativePermissions: InMemoryAdministrativePermissionStore;
}

function permissionKey(module: string, action: string): string {
  return `${module}:${action}`;
}

function createInMemoryAdministrativePermissionStore(): InMemoryAdministrativePermissionStore {
  const grants = new Set<string>();

  return {
    clear() {
      grants.clear();
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
}: TestAppOptions = {}): Promise<TestApp> {
  const users = createInMemoryUserRepository();
  const directors = createInMemoryRoleProvisionStore(users, 'DIRECTOR');
  const administratives = createInMemoryRoleProvisionStore(users, 'ADMINISTRATIVE');
  const teachers = createInMemoryRoleProvisionStore(users, 'TEACHER');
  const students = createInMemoryRoleProvisionStore(users, 'STUDENT');
  const administrativePermissions = createInMemoryAdministrativePermissionStore();
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
    },
    administratives: {
      authenticate: authOptions,
      administratives,
    },
    teachers: {
      authenticate: authOptions,
      teachers,
    },
    students: {
      authenticate: authOptions,
      students,
    },
    administrativePermissions: {
      authenticate: authOptions,
      administrativePermissions,
    },
  });

  return {
    app,
    users,
    directors,
    administratives,
    teachers,
    students,
    administrativePermissions,
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
