import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assignGroupTeacher,
  createGroup,
  getGroup,
  unassignGroupTeacher,
  updateGroup,
} from '../domain/groups/group-service.js';
import { createGroupStore } from '../domain/groups/group-store.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import {
  createScheduleOption,
  deleteScheduleOption,
} from '../domain/schedules/schedule-option-service.js';
import { createScheduleOptionStore } from '../domain/schedules/schedule-option-store.js';

/**
 * Persists Group.teacherId + Group.scheduleOptionId against real PostgreSQL.
 */
const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const TEACHER_EMAIL = 'group-sched-teacher@academia.test';
const COURSE_NAME = 'integration-group-schedule-course';
const GROUP_NAME = 'integration-group-schedule-group';

describe('group teacher + schedule option integration', () => {
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
    await database.group.deleteMany({
      where: { name: GROUP_NAME },
    });
    await database.course.deleteMany({
      where: { name: COURSE_NAME },
    });
    await database.scheduleOption.deleteMany({
      where: {
        AND: [{ day: 'MONDAY' }, { startTime: '18:00' }, { endTime: '20:00' }],
      },
    });
    await database.teacher.deleteMany({
      where: { user: { email: TEACHER_EMAIL } },
    });
    await database.user.deleteMany({
      where: { email: TEACHER_EMAIL },
    });
  }

  it('assigns teacher and schedule option on a group', async () => {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const teacherUser = await database.user.create({
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
        userId: teacherUser.id,
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'C1',
        availability: 'AVAILABLE',
        isActive: true,
      },
    });

    const groups = createGroupStore(database);
    const schedules = createScheduleOptionStore(database);

    const course = await database.course.create({
      data: {
        name: COURSE_NAME,
        description: 'integration',
        courseType: 'REGULAR', serviceType: 'GROUP_120',
        isActive: true,
      },
    });

    const group = await createGroup(groups, {
      courseId: course.id,
      name: GROUP_NAME,
    });
    expect(group.teacherId).toBeNull();
    expect(group.scheduleOptionId).toBeNull();

    const assigned = await assignGroupTeacher(groups, group.id, {
      teacherId: teacher.id,
    });
    expect(assigned.teacherId).toBe(teacher.id);

    const option = await createScheduleOption(schedules, {
      day: 'MONDAY',
      startTime: '18:00',
      endTime: '20:00',
    });
    expect(option.label).toBe('Lunes 18:00–20:00');

    const withSchedule = await updateGroup(groups, group.id, {
      scheduleOptionId: option.id,
    });
    expect(withSchedule.scheduleOptionId).toBe(option.id);

    const loaded = await getGroup(groups, group.id);
    expect(loaded.teacherId).toBe(teacher.id);
    expect(loaded.scheduleOptionId).toBe(option.id);

    await unassignGroupTeacher(groups, group.id);
    const clearedTeacher = await getGroup(groups, group.id);
    expect(clearedTeacher.teacherId).toBeNull();
    expect(clearedTeacher.scheduleOptionId).toBe(option.id);

    await deleteScheduleOption(schedules, option.id);
    const inactive = await schedules.findById(option.id);
    expect(inactive?.isActive).toBe(false);
  });
});
