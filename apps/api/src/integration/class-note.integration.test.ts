import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createClassNote,
  deleteClassNote,
  listClassNotes,
  updateClassNote,
} from '../domain/class-notes/class-note-service.js';
import { createClassNoteStore } from '../domain/class-notes/class-note-store.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const COURSE_NAME = 'integration-class-note-course';
const GROUP_NAME = 'integration-class-note-group';
const TEACHER_EMAIL = 'class-note-teacher@academia.test';

describe('class note integration', () => {
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
    await database.classNote.deleteMany({
      where: {
        classSession: { group: { name: { startsWith: GROUP_NAME } } },
      },
    });
    await database.classSession.deleteMany({
      where: { group: { name: { startsWith: GROUP_NAME } } },
    });
    await database.group.deleteMany({
      where: { name: { startsWith: GROUP_NAME } },
    });
    await database.course.deleteMany({
      where: { name: { startsWith: COURSE_NAME } },
    });
    await database.scheduleOption.deleteMany({
      where: {
        AND: [
          { day: 'WEDNESDAY' },
          { startTime: '16:00' },
          { endTime: '18:00' },
        ],
      },
    });
    await database.teacher.deleteMany({
      where: { user: { email: TEACHER_EMAIL } },
    });
    await database.user.deleteMany({ where: { email: TEACHER_EMAIL } });
  }

  async function seed() {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const user = await database.user.create({
      data: {
        email: TEACHER_EMAIL,
        name: 'Note Teacher',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
      },
    });
    const teacher = await database.teacher.create({
      data: {
        userId: user.id,
        firstName: 'Note',
        lastName: 'Teacher',
        level: 'C1',
        availability: 'AVAILABLE',
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
    const option = await database.scheduleOption.create({
      data: {
        day: 'WEDNESDAY',
        startTime: '16:00',
        endTime: '18:00',
        isActive: true,
      },
    });
    const group = await database.group.create({
      data: {
        courseId: course.id,
        name: GROUP_NAME,
        teacherId: teacher.id,
        scheduleOptionId: option.id,
        isActive: true,
      },
    });
    const session = await database.classSession.create({
      data: {
        groupId: group.id,
        startAt: new Date('2026-09-16T19:00:00.000Z'),
        endAt: new Date('2026-09-16T21:00:00.000Z'),
        meetingUrl: null,
        isActive: true,
      },
    });
    return { session, teacher };
  }

  it('persists notes with deterministic order and hard delete', async () => {
    const { session, teacher } = await seed();
    const store = createClassNoteStore(database);

    const first = await createClassNote(
      store,
      session.id,
      { content: 'Alpha' },
      { mode: 'teacher', teacherId: teacher.id },
    );
    const second = await createClassNote(
      store,
      session.id,
      { content: 'Beta' },
      { mode: 'admin' },
    );

    const listed = await listClassNotes(store, session.id);
    expect(listed.map((n) => n.content)).toEqual(['Alpha', 'Beta']);

    const updated = await updateClassNote(
      store,
      session.id,
      first.id,
      { content: 'Alpha revised' },
      { mode: 'admin' },
    );
    expect(updated.content).toBe('Alpha revised');

    await deleteClassNote(store, session.id, second.id, { mode: 'admin' });
    expect(
      await database.classNote.count({ where: { classSessionId: session.id } }),
    ).toBe(1);
  });
});
