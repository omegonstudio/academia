import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAuthService } from '../domain/identity/auth-service.js';
import {
  createAdministrativeProvisionStore,
  provisionAdministrative,
} from '../domain/identity/provision-administrative.js';
import {
  createDirectorProvisionStore,
  provisionDirector,
  RoleConflictError,
} from '../domain/identity/provision-director.js';
import {
  createTeacherProvisionStore,
  provisionTeacher,
} from '../domain/identity/provision-teacher.js';
import {
  createStudentProvisionStore,
  provisionStudent,
} from '../domain/identity/provision-student.js';
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
const DIRECTOR_EMAIL = 'directora@academia.test';
const ADMINISTRATIVE_EMAIL = 'admin@academia.test';
const TEACHER_EMAIL = 'docente@academia.test';
const STUDENT_EMAIL = 'estudiante@academia.test';
const BOOTSTRAP_PASSWORD = 'bootstrap-password-for-tests';
const DIRECTOR_PASSWORD = 'director-password-12';
const ADMINISTRATIVE_PASSWORD = 'admin-password-12';
const TEACHER_PASSWORD = 'teacher-password-12';
const STUDENT_PASSWORD = 'student-password-12';

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const CLEANUP_EMAILS = [
  SUPERADMIN_EMAIL,
  DIRECTOR_EMAIL,
  ADMINISTRATIVE_EMAIL,
  TEACHER_EMAIL,
  STUDENT_EMAIL,
  'teacher@academia.test',
];

describe('identity integration', () => {
  let database: Database;

  beforeAll(() => {
    database = createPrismaClient(DATABASE_URL);
  });

  afterAll(async () => {
    await database.user.deleteMany({
      where: { email: { in: CLEANUP_EMAILS } },
    });
    await database.$disconnect();
  });

  beforeEach(async () => {
    await database.user.deleteMany({
      where: { email: { in: CLEANUP_EMAILS } },
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

  describe('Director provisioning', () => {
    it('persists a DIRECTOR that can authenticate', async () => {
      const store = createDirectorProvisionStore(database);

      const result = await provisionDirector(store, {
        email: DIRECTOR_EMAIL,
        password: DIRECTOR_PASSWORD,
        name: 'Ana Directora',
      });

      expect(result.outcome).toBe('created');
      expect(result.user.role).toBe('DIRECTOR');

      const row = await database.user.findUniqueOrThrow({
        where: { email: DIRECTOR_EMAIL },
      });
      expect(row.role).toBe('DIRECTOR');
      expect(row.isActive).toBe(true);
      await expect(verifyPassword(DIRECTOR_PASSWORD, row.passwordHash)).resolves.toBe(
        true,
      );

      const service = createAuthService(createUserRepository(database));
      await expect(
        service.authenticate(DIRECTOR_EMAIL, DIRECTOR_PASSWORD),
      ).resolves.toMatchObject({ email: DIRECTOR_EMAIL, role: 'DIRECTOR' });
    });

    it('refuses to overwrite a SUPER_ADMIN email', async () => {
      await bootstrapSuperAdmin(database, {
        email: SUPERADMIN_EMAIL,
        password: BOOTSTRAP_PASSWORD,
      });

      const store = createDirectorProvisionStore(database);

      await expect(
        provisionDirector(store, {
          email: SUPERADMIN_EMAIL,
          password: DIRECTOR_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(RoleConflictError);
    });
  });

  describe('Administrative provisioning', () => {
    it('persists an ADMINISTRATIVE that can authenticate', async () => {
      const store = createAdministrativeProvisionStore(database);

      const result = await provisionAdministrative(store, {
        email: ADMINISTRATIVE_EMAIL,
        password: ADMINISTRATIVE_PASSWORD,
        name: 'Operaciones',
      });

      expect(result.outcome).toBe('created');
      expect(result.user.role).toBe('ADMINISTRATIVE');

      const row = await database.user.findUniqueOrThrow({
        where: { email: ADMINISTRATIVE_EMAIL },
      });
      expect(row.role).toBe('ADMINISTRATIVE');
      await expect(
        verifyPassword(ADMINISTRATIVE_PASSWORD, row.passwordHash),
      ).resolves.toBe(true);

      const service = createAuthService(createUserRepository(database));
      await expect(
        service.authenticate(ADMINISTRATIVE_EMAIL, ADMINISTRATIVE_PASSWORD),
      ).resolves.toMatchObject({
        email: ADMINISTRATIVE_EMAIL,
        role: 'ADMINISTRATIVE',
      });
    });

    it('refuses to overwrite a DIRECTOR email', async () => {
      await provisionDirector(createDirectorProvisionStore(database), {
        email: DIRECTOR_EMAIL,
        password: DIRECTOR_PASSWORD,
      });

      await expect(
        provisionAdministrative(createAdministrativeProvisionStore(database), {
          email: DIRECTOR_EMAIL,
          password: ADMINISTRATIVE_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(RoleConflictError);
    });
  });

  describe('Teacher provisioning', () => {
    it('persists a TEACHER that can authenticate', async () => {
      const store = createTeacherProvisionStore(database);

      const result = await provisionTeacher(store, {
        email: TEACHER_EMAIL,
        password: TEACHER_PASSWORD,
        name: 'María Docente',
      });

      expect(result.outcome).toBe('created');
      expect(result.user.role).toBe('TEACHER');

      const row = await database.user.findUniqueOrThrow({
        where: { email: TEACHER_EMAIL },
      });
      expect(row.role).toBe('TEACHER');
      await expect(verifyPassword(TEACHER_PASSWORD, row.passwordHash)).resolves.toBe(
        true,
      );

      const service = createAuthService(createUserRepository(database));
      await expect(
        service.authenticate(TEACHER_EMAIL, TEACHER_PASSWORD),
      ).resolves.toMatchObject({ email: TEACHER_EMAIL, role: 'TEACHER' });
    });

    it('refuses to overwrite a DIRECTOR email', async () => {
      await provisionDirector(createDirectorProvisionStore(database), {
        email: DIRECTOR_EMAIL,
        password: DIRECTOR_PASSWORD,
      });

      await expect(
        provisionTeacher(createTeacherProvisionStore(database), {
          email: DIRECTOR_EMAIL,
          password: TEACHER_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(RoleConflictError);
    });
  });

  describe('Student provisioning', () => {
    it('persists a STUDENT that can authenticate', async () => {
      const store = createStudentProvisionStore(database);

      const result = await provisionStudent(store, {
        email: STUDENT_EMAIL,
        password: STUDENT_PASSWORD,
        name: 'Lucía Estudiante',
      });

      expect(result.outcome).toBe('created');
      expect(result.user.role).toBe('STUDENT');

      const row = await database.user.findUniqueOrThrow({
        where: { email: STUDENT_EMAIL },
      });
      expect(row.role).toBe('STUDENT');
      await expect(verifyPassword(STUDENT_PASSWORD, row.passwordHash)).resolves.toBe(
        true,
      );

      const service = createAuthService(createUserRepository(database));
      await expect(
        service.authenticate(STUDENT_EMAIL, STUDENT_PASSWORD),
      ).resolves.toMatchObject({ email: STUDENT_EMAIL, role: 'STUDENT' });
    });

    it('refuses to overwrite a DIRECTOR email', async () => {
      await provisionDirector(createDirectorProvisionStore(database), {
        email: DIRECTOR_EMAIL,
        password: DIRECTOR_PASSWORD,
      });

      await expect(
        provisionStudent(createStudentProvisionStore(database), {
          email: DIRECTOR_EMAIL,
          password: STUDENT_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(RoleConflictError);
    });
  });
});
