import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createClassSession,
  generateClassSessionsForGroup,
  getClassSession,
  listClassSessions,
  listClassSessionsForCalendar,
} from '../domain/classes/class-session-service.js';
import { createClassSessionStore } from '../domain/classes/class-session-store.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const COURSE_NAME = 'integration-class-session-course';
const GROUP_NAME = 'integration-class-session-group';
const TEACHER_EMAIL = 'class-session-teacher@academia.test';
const ACADEMY = { businessTimezone: 'America/Argentina/Buenos_Aires' };

describe('class session integration', () => {
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
        AND: [{ day: 'MONDAY' }, { startTime: '18:00' }, { endTime: '20:00' }],
      },
    });
    await database.teacher.deleteMany({
      where: { user: { email: TEACHER_EMAIL } },
    });
    await database.user.deleteMany({ where: { email: TEACHER_EMAIL } });
  }

  async function seedReadyGroup() {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const user = await database.user.create({
      data: {
        email: TEACHER_EMAIL,
        name: 'Eva Ruiz',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
      },
    });
    const teacher = await database.teacher.create({
      data: {
        userId: user.id,
        firstName: 'Eva',
        lastName: 'Ruiz',
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
        day: 'MONDAY',
        startTime: '18:00',
        endTime: '20:00',
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
    return { group, teacher, option };
  }

  it('persists a concrete session with derived GROUP_120 duration', async () => {
    const { group, teacher, option } = await seedReadyGroup();

    const store = createClassSessionStore(database);
    const created = await createClassSession(store, {
      groupId: group.id,
      startAt: '2026-09-21T18:00:00.000Z',
    });

    expect(created).toMatchObject({
      groupId: group.id,
      serviceType: 'GROUP_120',
      durationMinutes: 120,
      endAt: '2026-09-21T20:00:00.000Z',
      teacherId: teacher.id,
      scheduleOptionId: option.id,
      meetingUrl: null,
    });

    const loaded = await getClassSession(store, created.id);
    expect(loaded.durationMinutes).toBe(120);
  });

  it('generates weekly sessions idempotently with UNIQUE(groupId, startAt)', async () => {
    const { group } = await seedReadyGroup();
    const store = createClassSessionStore(database);

    const first = await generateClassSessionsForGroup(
      store,
      group.id,
      { from: '2026-09-14', to: '2026-10-11' },
      ACADEMY,
    );
    expect(first.generatedCount).toBe(4);
    expect(first.conflictCount).toBe(0);
    expect(first.classSessions[0]!.startAt).toBe('2026-09-14T21:00:00.000Z');
    expect(first.classSessions[0]!.endAt).toBe('2026-09-14T23:00:00.000Z');

    const second = await generateClassSessionsForGroup(
      store,
      group.id,
      { from: '2026-09-14', to: '2026-10-11' },
      ACADEMY,
    );
    expect(second.generatedCount).toBe(0);
    expect(second.skippedCount).toBe(4);
    expect(second.conflictCount).toBe(0);
    expect(await listClassSessions(store, { groupId: group.id })).toHaveLength(
      4,
    );

    await expect(
      database.classSession.create({
        data: {
          groupId: group.id,
          startAt: new Date('2026-09-14T21:00:00.000Z'),
          endAt: new Date('2026-09-14T23:00:00.000Z'),
          isActive: true,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects overlapping create for the same teacher across groups', async () => {
    const { group, teacher, option } = await seedReadyGroup();
    const store = createClassSessionStore(database);

    const courseB = await database.course.create({
      data: {
        name: `${COURSE_NAME}-b`,
        description: null,
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
        isActive: true,
      },
    });
    const groupB = await database.group.create({
      data: {
        courseId: courseB.id,
        name: `${GROUP_NAME}-b`,
        teacherId: teacher.id,
        scheduleOptionId: option.id,
        isActive: true,
      },
    });

    await createClassSession(store, {
      groupId: group.id,
      startAt: '2026-09-21T10:00:00.000Z',
    });

    await expect(
      createClassSession(store, {
        groupId: groupB.id,
        startAt: '2026-09-21T11:00:00.000Z',
      }),
    ).rejects.toThrow(/conflicts/);

    await expect(
      createClassSession(store, {
        groupId: groupB.id,
        startAt: '2026-09-21T12:00:00.000Z',
      }),
    ).resolves.toMatchObject({ startAt: '2026-09-21T12:00:00.000Z' });
  });

  it('lists calendar events by academy-local range with nested relations', async () => {
    const { group, teacher } = await seedReadyGroup();
    const store = createClassSessionStore(database);

    await createClassSession(store, {
      groupId: group.id,
      startAt: '2026-09-14T21:00:00.000Z',
    });
    await createClassSession(store, {
      groupId: group.id,
      startAt: '2026-10-05T21:00:00.000Z',
    });

    const september = await listClassSessionsForCalendar(
      store,
      { from: '2026-09-01', to: '2026-09-30' },
      ACADEMY,
    );
    expect(september.classSessions).toHaveLength(1);
    expect(september.classSessions[0]).toMatchObject({
      startAt: '2026-09-14T21:00:00.000Z',
      group: {
        id: group.id,
        name: GROUP_NAME,
        course: {
          name: COURSE_NAME,
          serviceType: 'GROUP_120',
          courseType: 'REGULAR',
        },
      },
      teacher: {
        id: teacher.id,
        firstName: 'Eva',
        lastName: 'Ruiz',
      },
    });
  });
});
