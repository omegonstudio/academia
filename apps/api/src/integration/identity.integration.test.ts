import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAuthService } from '../domain/identity/auth-service.js';
import { createUserRepository } from '../domain/identity/user-repository.js';
import { createPrismaClient, isDatabaseReachable, type Database } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { bootstrapSuperAdmin } from '../seed/bootstrap.js';

/**
 * Exercises the identity stack against a real PostgreSQL with migrations
 * applied. Requires DATABASE_URL to point at a disposable database.
 */
const DATABASE_URL = process.env['DATABASE_URL'];
const SUPERADMIN_EMAIL = 'omegon.info@gmail.com';
const BOOTSTRAP_PASSWORD = 'bootstrap-password-for-tests';

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

describe('identity integration', () => {
  let database: Database;

  beforeAll(() => {
    database = createPrismaClient(DATABASE_URL);
  });

  afterAll(async () => {
    await database.user.deleteMany({
      where: { email: { in: [SUPERADMIN_EMAIL, 'teacher@academia.test'] } },
    });
    await database.$disconnect();
  });

  beforeEach(async () => {
    await database.user.deleteMany({
      where: { email: { in: [SUPERADMIN_EMAIL, 'teacher@academia.test'] } },
    });
  });

  it('reaches the database', async () => {
    await expect(isDatabaseReachable(database)).resolves.toBe(true);
  });

  it('has the migrated users table with its unique email constraint', async () => {
    await database.user.create({
      data: {
        email: 'teacher@academia.test',
        passwordHash: await hashPassword('irrelevant-password'),
        role: 'TEACHER',
      },
    });

    await expect(
      database.user.create({
        data: {
          email: 'teacher@academia.test',
          passwordHash: await hashPassword('irrelevant-password'),
          role: 'STUDENT',
        },
      }),
    ).rejects.toThrow();
  });

  describe('SuperAdmin bootstrap', () => {
    it('creates the account when it is absent', async () => {
      const outcome = await bootstrapSuperAdmin(database, {
        email: SUPERADMIN_EMAIL,
        password: BOOTSTRAP_PASSWORD,
      });

      expect(outcome).toBe('created');

      const user = await database.user.findUnique({
        where: { email: SUPERADMIN_EMAIL },
      });

      expect(user?.role).toBe('SUPER_ADMIN');
      expect(user?.isActive).toBe(true);
      expect(user?.passwordHash).not.toContain(BOOTSTRAP_PASSWORD);
    });

    it('is idempotent and never overwrites an existing password', async () => {
      await bootstrapSuperAdmin(database, {
        email: SUPERADMIN_EMAIL,
        password: BOOTSTRAP_PASSWORD,
      });

      const rotated = await hashPassword('a-rotated-production-password');
      await database.user.update({
        where: { email: SUPERADMIN_EMAIL },
        data: { passwordHash: rotated },
      });

      const outcome = await bootstrapSuperAdmin(database, {
        email: SUPERADMIN_EMAIL,
        password: BOOTSTRAP_PASSWORD,
      });

      expect(outcome).toBe('reasserted');

      const user = await database.user.findUnique({
        where: { email: SUPERADMIN_EMAIL },
      });
      expect(user?.passwordHash).toBe(rotated);
    });

    it('re-asserts the role and reactivates a downgraded account', async () => {
      await bootstrapSuperAdmin(database, {
        email: SUPERADMIN_EMAIL,
        password: BOOTSTRAP_PASSWORD,
      });

      await database.user.update({
        where: { email: SUPERADMIN_EMAIL },
        data: { role: 'STUDENT', isActive: false },
      });

      await bootstrapSuperAdmin(database, {
        email: SUPERADMIN_EMAIL,
        password: BOOTSTRAP_PASSWORD,
      });

      const user = await database.user.findUnique({
        where: { email: SUPERADMIN_EMAIL },
      });

      expect(user?.role).toBe('SUPER_ADMIN');
      expect(user?.isActive).toBe(true);
    });

    it('skips provisioning when no password is available', async () => {
      const outcome = await bootstrapSuperAdmin(database, {
        email: SUPERADMIN_EMAIL,
        password: undefined,
      });

      expect(outcome).toBe('skipped');
      await expect(
        database.user.findUnique({ where: { email: SUPERADMIN_EMAIL } }),
      ).resolves.toBeNull();
    });

    it('normalises the email it provisions', async () => {
      await bootstrapSuperAdmin(database, {
        email: '  OMEGON.Info@Gmail.com  ',
        password: BOOTSTRAP_PASSWORD,
      });

      await expect(
        database.user.findUnique({ where: { email: SUPERADMIN_EMAIL } }),
      ).resolves.not.toBeNull();
    });
  });

  describe('authentication against the real repository', () => {
    beforeEach(async () => {
      await bootstrapSuperAdmin(database, {
        email: SUPERADMIN_EMAIL,
        password: BOOTSTRAP_PASSWORD,
      });
    });

    it('authenticates the bootstrapped SuperAdmin', async () => {
      const service = createAuthService(createUserRepository(database));

      const user = await service.authenticate(SUPERADMIN_EMAIL, BOOTSTRAP_PASSWORD);

      expect(user).toMatchObject({
        email: SUPERADMIN_EMAIL,
        role: 'SUPER_ADMIN',
      });
    });

    it('rejects a wrong password', async () => {
      const service = createAuthService(createUserRepository(database));

      await expect(
        service.authenticate(SUPERADMIN_EMAIL, 'not-the-password'),
      ).resolves.toBeNull();
    });

    it('persists the login timestamp', async () => {
      const service = createAuthService(createUserRepository(database));

      await service.authenticate(SUPERADMIN_EMAIL, BOOTSTRAP_PASSWORD);

      const user = await database.user.findUnique({
        where: { email: SUPERADMIN_EMAIL },
      });
      expect(user?.lastLoginAt).toBeInstanceOf(Date);
    });

    it('stores a verifiable hash rather than the plaintext', async () => {
      const user = await database.user.findUniqueOrThrow({
        where: { email: SUPERADMIN_EMAIL },
      });

      expect(user.passwordHash).not.toContain(BOOTSTRAP_PASSWORD);
      await expect(
        verifyPassword(BOOTSTRAP_PASSWORD, user.passwordHash),
      ).resolves.toBe(true);
    });
  });
});
