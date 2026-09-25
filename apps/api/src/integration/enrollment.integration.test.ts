import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GROUP_MAX_ACTIVE_ENROLLMENTS } from '@academia/shared';
import {
  enrollStudentInGroup,
  EnrollmentValidationError,
  listGroupEnrollments,
  unenrollStudentFromGroup,
} from '../domain/enrollments/enrollment-service.js';
import { createEnrollmentStore } from '../domain/enrollments/enrollment-store.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

/**
 * Persists Enrollment + max-15 capacity against real PostgreSQL.
 */
const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const COURSE_NAME = 'integration-enrollment-course';
const GROUP_NAME = 'integration-enrollment-group';
const STUDENT_EMAIL_PREFIX = 'enr-student-';

describe('group enrollment integration', () => {
  let database: Database;

  beforeAll(() => {
    database = createPrismaClient(DATABASE_URL);
  });

  afterAll(async () => {
    await cleanup();
    await database.$disconnect();
  });

  beforeEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    await database.enrollment.deleteMany({
      where: { group: { name: GROUP_NAME } },
    });
    await database.group.deleteMany({ where: { name: GROUP_NAME } });
    await database.course.deleteMany({ where: { name: COURSE_NAME } });
    await database.student.deleteMany({
      where: { user: { email: { startsWith: STUDENT_EMAIL_PREFIX } } },
    });
    await database.user.deleteMany({
      where: { email: { startsWith: STUDENT_EMAIL_PREFIX } },
    });
  }

  async function seedStudent(index: number): Promise<string> {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const user = await database.user.create({
      data: {
        email: `${STUDENT_EMAIL_PREFIX}${index}@academia.test`,
        name: `Student ${index}`,
        passwordHash,
        role: 'STUDENT',
        isActive: true,
      },
    });
    const student = await database.student.create({
      data: {
        userId: user.id,
        firstName: 'Ana',
        lastName: `Pérez${index}`,
        level: 'A2',
        isActive: true,
      },
    });
    return student.id;
  }

  it('persists membership and enforces max 15 under concurrent enrolls', async () => {
    const course = await database.course.create({
      data: {
        name: COURSE_NAME,
        description: null,
        courseType: 'REGULAR', serviceType: 'GROUP_120',
        isActive: true,
      },
    });
    const group = await database.group.create({
      data: {
        courseId: course.id,
        name: GROUP_NAME,
        isActive: true,
      },
    });

    const store = createEnrollmentStore(database);
    const first = await seedStudent(0);
    const enrollment = await enrollStudentInGroup(store, group.id, {
      studentId: first,
    });
    expect(enrollment.isActive).toBe(true);
    expect(await listGroupEnrollments(store, group.id)).toHaveLength(1);

    await unenrollStudentFromGroup(store, group.id, first);
    expect(await listGroupEnrollments(store, group.id)).toHaveLength(0);

    // Fill to 14, then race two enrolls for the last seats — exactly one of
    // the overflow pair must fail when starting from 14... better: fill 14,
    // then fire two concurrent enrolls → one succeeds (15), one fails (16).
    const studentIds: string[] = [];
    for (let i = 1; i <= 14; i += 1) {
      studentIds.push(await seedStudent(i));
    }
    for (const studentId of studentIds) {
      await enrollStudentInGroup(store, group.id, { studentId });
    }
    expect(await listGroupEnrollments(store, group.id)).toHaveLength(14);

    const a = await seedStudent(100);
    const b = await seedStudent(101);
    const results = await Promise.allSettled([
      enrollStudentInGroup(store, group.id, { studentId: a }),
      enrollStudentInGroup(store, group.id, { studentId: b }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ status: 'rejected' });
    if (rejected[0]?.status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(EnrollmentValidationError);
    }

    expect(await listGroupEnrollments(store, group.id)).toHaveLength(
      GROUP_MAX_ACTIVE_ENROLLMENTS,
    );

    const overflow = await seedStudent(102);
    await expect(
      enrollStudentInGroup(store, group.id, { studentId: overflow }),
    ).rejects.toThrow(/full/);
  });
});
