import type { Express } from 'express';
import { createAuthService } from '../domain/identity/auth-service.js';
import { createSessionCodec } from '../domain/identity/session.js';
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

export interface TestApp {
  app: Express;
  users: InMemoryUserRepository;
}

/**
 * Builds the real Express stack over test doubles, so route tests cover the
 * actual middleware chain (logging, CORS, validation, error handling) rather
 than a hand-rolled approximation.
 */
export async function buildTestApp({
  databaseReachable = true,
  configurationIssues = [],
}: TestAppOptions = {}): Promise<TestApp> {
  const users = createInMemoryUserRepository();
  const authService = createAuthService(users);

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
      sessionCodec: createSessionCodec(TEST_SECRET, 3600),
      cookie: { name: SESSION_COOKIE, secure: false, ttlSeconds: 3600 },
    },
  });

  return { app, users };
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
