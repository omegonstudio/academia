import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTeacherAssignmentStore } from '../domain/assignments/assignment-store.js';
import {
  assignTeacherToStudent,
  getStudentTeacherAssignment,
  unassignTeacherFromStudent,
} from '../domain/assignments/assignment-service.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

/**
 * Persists TeacherAssignment against real PostgreSQL.
 */
const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const STUDENT_EMAIL = 'assign-student@academia.test';
const TEACHER_EMAIL = 'assign-teacher@academia.test';
const TEACHER_B_EMAIL = 'assign-teacher-b@academia.test';

describe('teacher assignment integration', () => {
  let database: Database;

  beforeAll(() => {
    database = createPrismaClient(DATABASE_URL);
  });

  afterAll(async () => {
    await database.teacherAssignment.deleteMany({
      where: {
        OR: [
          { student: { user: { email: STUDENT_EMAIL } } },
          {
            teacher: {
              user: { email: { in: [TEACHER_EMAIL, TEACHER_B_EMAIL] } },
            },
          },
        ],
      },
    });
    await database.student.deleteMany({
      where: { user: { email: STUDENT_EMAIL } },
    });
    await database.teacher.deleteMany({
      where: {
        user: { email: { in: [TEACHER_EMAIL, TEACHER_B_EMAIL] } },
      },
    });
    await database.user.deleteMany({
      where: {
        email: { in: [STUDENT_EMAIL, TEACHER_EMAIL, TEACHER_B_EMAIL] },
      },
    });
    await database.$disconnect();
  });

  beforeEach(async () => {
    await database.teacherAssignment.deleteMany({
      where: {
        OR: [
          { student: { user: { email: STUDENT_EMAIL } } },
          {
            teacher: {
              user: { email: { in: [TEACHER_EMAIL, TEACHER_B_EMAIL] } },
            },
          },
        ],
      },
    });
    await database.student.deleteMany({
      where: { user: { email: STUDENT_EMAIL } },
    });
    await database.teacher.deleteMany({
      where: {
        user: { email: { in: [TEACHER_EMAIL, TEACHER_B_EMAIL] } },
      },
    });
    await database.user.deleteMany({
      where: {
        email: { in: [STUDENT_EMAIL, TEACHER_EMAIL, TEACHER_B_EMAIL] },
      },
    });
  });

  it('persists, replaces and removes the Student → Teacher link', async () => {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const studentUser = await database.user.create({
      data: {
        email: STUDENT_EMAIL,
        name: 'Ana Pérez',
        passwordHash,
        role: 'STUDENT',
        isActive: true,
      },
    });
    const teacherUser = await database.user.create({
      data: {
        email: TEACHER_EMAIL,
        name: 'Eva Ruiz',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
      },
    });
    const teacherBUser = await database.user.create({
      data: {
        email: TEACHER_B_EMAIL,
        name: 'Luis Mora',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
      },
    });

    const student = await database.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'Ana',
        lastName: 'Pérez',
        level: 'A1',
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
    const teacherB = await database.teacher.create({
      data: {
        userId: teacherBUser.id,
        firstName: 'Luis',
        lastName: 'Mora',
        level: 'C2',
        availability: 'AVAILABLE',
        isActive: true,
      },
    });

    const store = createTeacherAssignmentStore(database);
    const directorActor = {
      id: studentUser.id,
      role: 'DIRECTOR' as const,
    };

    const assigned = await assignTeacherToStudent(
      store,
      student.id,
      { teacherId: teacher.id },
      directorActor,
    );
    expect(assigned.teacherId).toBe(teacher.id);

    const row = await database.teacherAssignment.findUnique({
      where: { studentId: student.id },
    });
    expect(row?.teacherId).toBe(teacher.id);

    const replaced = await assignTeacherToStudent(
      store,
      student.id,
      { teacherId: teacherB.id },
      directorActor,
    );
    expect(replaced.teacherId).toBe(teacherB.id);

    const afterReplace = await database.teacherAssignment.findMany({
      where: { studentId: student.id },
    });
    expect(afterReplace).toHaveLength(1);
    expect(afterReplace[0]?.teacherId).toBe(teacherB.id);

    const got = await getStudentTeacherAssignment(store, student.id);
    expect(got.teacherId).toBe(teacherB.id);

    await unassignTeacherFromStudent(store, student.id);
    expect(
      await database.teacherAssignment.findUnique({
        where: { studentId: student.id },
      }),
    ).toBeNull();

    await expect(
      assignTeacherToStudent(
        store,
        student.id,
        { teacherId: teacher.id },
        { id: teacherUser.id, role: 'TEACHER' },
      ),
    ).rejects.toMatchObject({
      name: 'AssignmentValidationError',
      message: 'Teachers cannot assign students to themselves.',
    });
  });
});
