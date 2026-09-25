import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCourse,
  getCourse,
  updateCourse,
} from '../domain/courses/course-service.js';
import { createCourseStore } from '../domain/courses/course-store.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const COURSE_NAME = 'integration-service-type-course';
const TRAINING_NAME = 'integration-course-type-training';

describe('course serviceType integration', () => {
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
    await database.course.deleteMany({
      where: { name: { in: [COURSE_NAME, TRAINING_NAME] } },
    });
  }

  it('persists serviceType and derives durationMinutes', async () => {
    const store = createCourseStore(database);

    const created = await createCourse(store, {
      name: COURSE_NAME,
      courseType: 'REGULAR',
      serviceType: 'ONE_TO_ONE_90',
    });
    expect(created.courseType).toBe('REGULAR');
    expect(created.serviceType).toBe('ONE_TO_ONE_90');
    expect(created.durationMinutes).toBe(90);

    const loaded = await getCourse(store, created.id);
    expect(loaded.durationMinutes).toBe(90);

    const patched = await updateCourse(store, created.id, {
      serviceType: 'GROUP_120',
    });
    expect(patched).toMatchObject({
      courseType: 'REGULAR',
      serviceType: 'GROUP_120',
      durationMinutes: 120,
    });
  });

  it('persists TEACHER_TRAINING without altering duration derivation', async () => {
    const store = createCourseStore(database);

    const created = await createCourse(store, {
      name: TRAINING_NAME,
      courseType: 'TEACHER_TRAINING',
      serviceType: 'GROUP_120',
    });
    expect(created).toMatchObject({
      courseType: 'TEACHER_TRAINING',
      serviceType: 'GROUP_120',
      durationMinutes: 120,
    });

    const patched = await updateCourse(store, created.id, {
      serviceType: 'ONE_TO_ONE_60',
    });
    expect(patched).toMatchObject({
      courseType: 'TEACHER_TRAINING',
      serviceType: 'ONE_TO_ONE_60',
      durationMinutes: 60,
    });
  });
});
