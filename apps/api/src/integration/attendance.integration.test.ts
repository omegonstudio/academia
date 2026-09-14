import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AttendanceAlreadyExistsError,
  createAttendance,
  listAttendanceForClassSession,
  updateAttendance,
} from '../domain/attendance/attendance-service.js';
import { createAttendanceStore } from '../domain/attendance/attendance-store.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const COURSE_NAME = 'integration-attendance-course';
const GROUP_NAME = 'integration-attendance-group';
const TEACHER_EMAIL = 'attendance-teacher@academia.test';
const STUDENT_EMAIL = 'attendance-student@academia.test';

describe('attendance integration', () => {
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
    await database.attendance.deleteMany({
      where: {
        classSession: { group: { name: { startsWith: GROUP_NAME } } },
      },
    });
    await database.classSession.deleteMany({
      where: { group: { name: { startsWith: GROUP_NAME } } },
    });
    await database.enrollment.deleteMany({
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
        AND: [{ day: 'TUESDAY' }, { startTime: '10:00' }, { endTime: '12:00' }],
      },
    });
    await database.teacher.deleteMany({
      where: { user: { email: TEACHER_EMAIL } },
    });
    await database.student.deleteMany({
      where: { user: { email: STUDENT_EMAIL } },
    });
    await database.user.deleteMany({
      where: { email: { in: [TEACHER_EMAIL, STUDENT_EMAIL] } },
    });
  }

  async function seed() {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const teacherUser = await database.user.create({
      data: {
        email: TEACHER_EMAIL,
        name: 'Att Teacher',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
      },
    });
    const teacher = await database.teacher.create({
      data: {
        userId: teacherUser.id,
        firstName: 'Att',
        lastName: 'Teacher',
        level: 'C1',
        availability: 'AVAILABLE',
        isActive: true,
      },
    });
    const studentUser = await database.user.create({
      data: {
        email: STUDENT_EMAIL,
        name: 'Att Student',
        passwordHash,
        role: 'STUDENT',
        isActive: true,
      },
    });
    const student = await database.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'Att',
        lastName: 'Student',
        level: 'B1',
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
        day: 'TUESDAY',
        startTime: '10:00',
        endTime: '12:00',
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
    await database.enrollment.create({
      data: {
        groupId: group.id,
        studentId: student.id,
        isActive: true,
      },
    });
    const session = await database.classSession.create({
      data: {
        groupId: group.id,
        startAt: new Date('2026-09-15T13:00:00.000Z'),
        endAt: new Date('2026-09-15T15:00:00.000Z'),
        meetingUrl: null,
        isActive: true,
      },
    });
    return { group, student, session, teacher };
  }

  it('persists attendance, enforces unique pair, and blocks write after unenroll', async () => {
    const { group, student, session, teacher } = await seed();
    const store = createAttendanceStore(database);

    const created = await createAttendance(
      store,
      session.id,
      { studentId: student.id, status: 'PRESENT' },
      { mode: 'teacher', teacherId: teacher.id },
    );
    expect(created.status).toBe('PRESENT');

    await expect(
      createAttendance(
        store,
        session.id,
        { studentId: student.id, status: 'ABSENT' },
        { mode: 'admin' },
      ),
    ).rejects.toBeInstanceOf(AttendanceAlreadyExistsError);

    const updated = await updateAttendance(
      store,
      session.id,
      student.id,
      { status: 'ABSENT' },
      { mode: 'admin' },
    );
    expect(updated.status).toBe('ABSENT');

    await database.attendance.deleteMany({
      where: { classSessionId: session.id },
    });

    const [first, second] = await Promise.allSettled([
      createAttendance(
        store,
        session.id,
        { studentId: student.id, status: 'PRESENT' },
        { mode: 'admin' },
      ),
      createAttendance(
        store,
        session.id,
        { studentId: student.id, status: 'PRESENT' },
        { mode: 'admin' },
      ),
    ]);
    const outcomes = [first, second];
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await database.attendance.count({
        where: { classSessionId: session.id, studentId: student.id },
      }),
    ).toBe(1);

    await updateAttendance(
      store,
      session.id,
      student.id,
      { status: 'ABSENT' },
      { mode: 'admin' },
    );

    await database.enrollment.updateMany({
      where: { groupId: group.id, studentId: student.id },
      data: { isActive: false },
    });

    await expect(
      updateAttendance(
        store,
        session.id,
        student.id,
        { status: 'PRESENT' },
        { mode: 'admin' },
      ),
    ).rejects.toMatchObject({ name: 'AttendanceValidationError' });

    const listed = await listAttendanceForClassSession(store, session.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe('ABSENT');
  });
});
