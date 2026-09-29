import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createLinkMaterial,
  softDeleteMaterial,
} from '../domain/materials/material-service.js';
import { createMaterialStore } from '../domain/materials/material-store.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { createInMemoryObjectStorage } from '../storage/in-memory-object-storage.js';

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const COURSE_NAME = 'integration-material-course';
const USER_EMAIL = 'material-integration@academia.test';

describe('material integration', () => {
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
    await database.material.deleteMany({
      where: {
        OR: [
          { course: { name: { startsWith: COURSE_NAME } } },
          { createdBy: { email: USER_EMAIL } },
        ],
      },
    });
    await database.course.deleteMany({
      where: { name: { startsWith: COURSE_NAME } },
    });
    await database.user.deleteMany({ where: { email: USER_EMAIL } });
  }

  async function seed() {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const user = await database.user.create({
      data: {
        email: USER_EMAIL,
        name: 'Material User',
        passwordHash,
        role: 'DIRECTOR',
        isActive: true,
      },
    });
    const course = await database.course.create({
      data: {
        name: COURSE_NAME,
        description: null,
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
        isActive: true,
      },
    });
    return { user, course };
  }

  it('persists LINK material CRUD and soft-delete via Prisma store', async () => {
    const { user, course } = await seed();
    const store = createMaterialStore(database);
    const storage = createInMemoryObjectStorage();

    const created = await createLinkMaterial(
      store,
      { mode: 'admin' },
      user.id,
      {
        title: 'Integration link',
        kind: 'LINK',
        externalUrl: 'https://example.com/integration',
        courseId: course.id,
      },
    );
    expect(created.courseId).toBe(course.id);
    expect(created.classSessionId).toBeNull();
    expect(created.uploadStatus).toBe('READY');

    const row = await database.material.findUnique({
      where: { id: created.id },
    });
    expect(row?.externalUrl).toBe('https://example.com/integration');
    expect(row?.isActive).toBe(true);

    await softDeleteMaterial(
      store,
      storage,
      { mode: 'admin' },
      created.id,
      () => undefined,
    );

    const deleted = await database.material.findUnique({
      where: { id: created.id },
    });
    expect(deleted?.isActive).toBe(false);
  });

  it('enforces Course XOR ClassSession at the database level', async () => {
    const { user, course } = await seed();

    await expect(
      database.material.create({
        data: {
          title: 'Neither',
          kind: 'LINK',
          uploadStatus: 'READY',
          externalUrl: 'https://example.com/neither',
          courseId: null,
          classSessionId: null,
          createdByUserId: user.id,
        },
      }),
    ).rejects.toThrow();

    // Both associations set — also violates XOR check.
    // Need a class session FK; create minimal group/session for the positive both-set case.
    const option = await database.scheduleOption.create({
      data: {
        day: 'FRIDAY',
        startTime: '09:00',
        endTime: '11:00',
        isActive: true,
      },
    });
    const group = await database.group.create({
      data: {
        courseId: course.id,
        name: `${COURSE_NAME}-group`,
        scheduleOptionId: option.id,
        isActive: true,
      },
    });
    const session = await database.classSession.create({
      data: {
        groupId: group.id,
        startAt: new Date('2026-09-18T12:00:00.000Z'),
        endAt: new Date('2026-09-18T14:00:00.000Z'),
        meetingUrl: null,
        isActive: true,
      },
    });

    await expect(
      database.material.create({
        data: {
          title: 'Both',
          kind: 'LINK',
          uploadStatus: 'READY',
          externalUrl: 'https://example.com/both',
          courseId: course.id,
          classSessionId: session.id,
          createdByUserId: user.id,
        },
      }),
    ).rejects.toThrow();

    // Cleanup extras created only for this case.
    await database.classSession.delete({ where: { id: session.id } });
    await database.group.delete({ where: { id: group.id } });
    await database.scheduleOption.delete({ where: { id: option.id } });
  });
});
