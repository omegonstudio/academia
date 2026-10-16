import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { enrollFree } from '../domain/online-courses/online-access-service.js';
import {
  createOnlineCourse,
  createOnlineCourseModule,
  createOnlineLesson,
  createOnlineLessonAsset,
  publishOnlineCourse,
} from '../domain/online-courses/online-course-service.js';
import { createOnlineCourseStore } from '../domain/online-courses/online-course-store.js';
import {
  completeLesson,
  startLesson,
} from '../domain/online-courses/online-progress-service.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

/**
 * Happy path against real PostgreSQL:
 * create → module/lesson/TEXT asset → publish → enroll-free → progress.
 */
const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const SLUG_PREFIX = 'integ-online-';
const STUDENT_EMAIL = 'online-integ-student@academia.test';
const DIRECTOR_EMAIL = 'online-integ-director@academia.test';

describe('online courses integration', () => {
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
    const courses = await database.onlineCourse.findMany({
      where: { slug: { startsWith: SLUG_PREFIX } },
      select: { id: true },
    });
    const courseIds = courses.map((c) => c.id);

    if (courseIds.length > 0) {
      const modules = await database.onlineCourseModule.findMany({
        where: { onlineCourseId: { in: courseIds } },
        select: { id: true },
      });
      const moduleIds = modules.map((m) => m.id);
      const lessons =
        moduleIds.length > 0
          ? await database.onlineLesson.findMany({
              where: { moduleId: { in: moduleIds } },
              select: { id: true },
            })
          : [];
      const lessonIds = lessons.map((l) => l.id);

      if (lessonIds.length > 0) {
        await database.onlineLessonProgress.deleteMany({
          where: { lessonId: { in: lessonIds } },
        });
        await database.onlineLessonAsset.deleteMany({
          where: { lessonId: { in: lessonIds } },
        });
        await database.onlineLesson.deleteMany({
          where: { id: { in: lessonIds } },
        });
      }
      if (moduleIds.length > 0) {
        await database.onlineCourseModule.deleteMany({
          where: { id: { in: moduleIds } },
        });
      }
      await database.onlineCourseAccess.deleteMany({
        where: { onlineCourseId: { in: courseIds } },
      });
      await database.onlineCourse.deleteMany({
        where: { id: { in: courseIds } },
      });
    }

    await database.student.deleteMany({
      where: { user: { email: STUDENT_EMAIL } },
    });
    await database.user.deleteMany({
      where: { email: { in: [STUDENT_EMAIL, DIRECTOR_EMAIL] } },
    });
  }

  it('persists publish → enroll-free → progress via Prisma store', async () => {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const director = await database.user.create({
      data: {
        email: DIRECTOR_EMAIL,
        name: 'Online Director',
        passwordHash,
        role: 'DIRECTOR',
        isActive: true,
      },
    });
    const studentUser = await database.user.create({
      data: {
        email: STUDENT_EMAIL,
        name: 'Online Student',
        passwordHash,
        role: 'STUDENT',
        isActive: true,
      },
    });
    const student = await database.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'Integ',
        lastName: 'Student',
        level: 'A1',
        isActive: true,
      },
    });

    const store = createOnlineCourseStore(database);
    const slug = `${SLUG_PREFIX}happy-path`;

    const course = await createOnlineCourse(store, {
      title: 'Integration Online Course',
      slug,
      accessMode: 'OPEN',
    });
    expect(course.status).toBe('DRAFT');

    const mod = await createOnlineCourseModule(store, course.id, {
      title: 'Module 1',
    });
    const lesson = await createOnlineLesson(store, mod.id, {
      title: 'Lesson 1',
      status: 'PUBLISHED',
      isRequired: true,
    });
    await createOnlineLessonAsset(store, lesson.id, director.id, {
      kind: 'TEXT',
      title: 'Welcome',
      bodyText: 'Hola integración',
    });

    const published = await publishOnlineCourse(store, course.id);
    expect(published.status).toBe('PUBLISHED');

    const row = await database.onlineCourse.findUnique({
      where: { id: course.id },
    });
    expect(row?.status).toBe('PUBLISHED');
    expect(row?.isActive).toBe(true);

    const access = await enrollFree(store, student.id, course.id);
    expect(access.isActive).toBe(true);
    expect(access.studentId).toBe(student.id);

    const started = await startLesson(store, {
      studentId: student.id,
      lessonId: lesson.id,
    });
    expect(started?.status).toBe('IN_PROGRESS');

    const completed = await completeLesson(store, {
      studentId: student.id,
      lessonId: lesson.id,
    });
    expect(completed?.status).toBe('COMPLETED');

    const progress = await database.onlineLessonProgress.findUnique({
      where: {
        lessonId_studentId: {
          lessonId: lesson.id,
          studentId: student.id,
        },
      },
    });
    expect(progress?.status).toBe('COMPLETED');
  });
});
