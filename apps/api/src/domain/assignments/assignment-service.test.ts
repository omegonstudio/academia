import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AssignmentNotFoundError,
  AssignmentValidationError,
  assignTeacherToStudent,
  getStudentTeacherAssignment,
  unassignTeacherFromStudent,
  type AssignmentActor,
  type TeacherAssignmentStore,
} from './assignment-service.js';

const directorActor: AssignmentActor = {
  id: randomUUID(),
  role: 'DIRECTOR',
};

function createStore(
  overrides: Partial<TeacherAssignmentStore> = {},
): TeacherAssignmentStore {
  const studentId = randomUUID();
  const teacherId = randomUUID();
  const studentUserId = randomUUID();
  const teacherUserId = randomUUID();

  return {
    findByStudentId: vi.fn(async () => null),
    findStudent: vi.fn(async (id) =>
      id === studentId
        ? { id: studentId, userId: studentUserId, isActive: true }
        : null,
    ),
    findTeacher: vi.fn(async (id) =>
      id === teacherId
        ? { id: teacherId, userId: teacherUserId, isActive: true }
        : null,
    ),
    upsert: vi.fn(async (sid, tid) => ({
      studentId: sid,
      teacherId: tid,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })),
    deleteByStudentId: vi.fn(async () => true),
    ...overrides,
  };
}

describe('assignTeacherToStudent', () => {
  it('assigns an active teacher to an active student', async () => {
    const studentId = randomUUID();
    const teacherId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      findTeacher: vi.fn(async () => ({
        id: teacherId,
        userId: randomUUID(),
        isActive: true,
      })),
    });

    const assignment = await assignTeacherToStudent(
      store,
      studentId,
      { teacherId },
      directorActor,
    );

    expect(store.upsert).toHaveBeenCalledWith(studentId, teacherId);
    expect(assignment.studentId).toBe(studentId);
    expect(assignment.teacherId).toBe(teacherId);
  });

  it('rejects missing student', async () => {
    const store = createStore({
      findStudent: vi.fn(async () => null),
    });

    await expect(
      assignTeacherToStudent(
        store,
        randomUUID(),
        { teacherId: randomUUID() },
        directorActor,
      ),
    ).rejects.toBeInstanceOf(AssignmentValidationError);
  });

  it('rejects inactive student', async () => {
    const studentId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: false,
      })),
    });

    await expect(
      assignTeacherToStudent(
        store,
        studentId,
        { teacherId: randomUUID() },
        directorActor,
      ),
    ).rejects.toMatchObject({
      name: 'AssignmentValidationError',
      message: 'Student is inactive.',
    });
  });

  it('rejects missing teacher', async () => {
    const studentId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      findTeacher: vi.fn(async () => null),
    });

    await expect(
      assignTeacherToStudent(
        store,
        studentId,
        { teacherId: randomUUID() },
        directorActor,
      ),
    ).rejects.toMatchObject({
      name: 'AssignmentValidationError',
      message: 'Teacher not found.',
    });
  });

  it('rejects inactive teacher', async () => {
    const studentId = randomUUID();
    const teacherId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      findTeacher: vi.fn(async () => ({
        id: teacherId,
        userId: randomUUID(),
        isActive: false,
      })),
    });

    await expect(
      assignTeacherToStudent(
        store,
        studentId,
        { teacherId },
        directorActor,
      ),
    ).rejects.toMatchObject({
      name: 'AssignmentValidationError',
      message: 'Teacher is inactive.',
    });
  });

  it('rejects assigning a student profile to a teacher profile with the same User', async () => {
    const studentId = randomUUID();
    const teacherId = randomUUID();
    const sharedUserId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: sharedUserId,
        isActive: true,
      })),
      findTeacher: vi.fn(async () => ({
        id: teacherId,
        userId: sharedUserId,
        isActive: true,
      })),
    });

    await expect(
      assignTeacherToStudent(
        store,
        studentId,
        { teacherId },
        directorActor,
      ),
    ).rejects.toMatchObject({
      name: 'AssignmentValidationError',
      message: 'A student cannot be assigned to themselves.',
    });
  });

  it('rejects when a TEACHER actor assigns a student to themselves', async () => {
    const studentId = randomUUID();
    const teacherId = randomUUID();
    const teacherUserId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      findTeacher: vi.fn(async () => ({
        id: teacherId,
        userId: teacherUserId,
        isActive: true,
      })),
    });

    await expect(
      assignTeacherToStudent(
        store,
        studentId,
        { teacherId },
        { id: teacherUserId, role: 'TEACHER' },
      ),
    ).rejects.toMatchObject({
      name: 'AssignmentValidationError',
      message: 'Teachers cannot assign students to themselves.',
    });
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('allows a TEACHER actor to assign a student to a different teacher', async () => {
    const studentId = randomUUID();
    const teacherId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      findTeacher: vi.fn(async () => ({
        id: teacherId,
        userId: randomUUID(),
        isActive: true,
      })),
    });

    const assignment = await assignTeacherToStudent(
      store,
      studentId,
      { teacherId },
      { id: randomUUID(), role: 'TEACHER' },
    );

    expect(assignment.teacherId).toBe(teacherId);
    expect(store.upsert).toHaveBeenCalled();
  });
});

describe('getStudentTeacherAssignment', () => {
  it('returns the assignment when present', async () => {
    const studentId = randomUUID();
    const teacherId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      findByStudentId: vi.fn(async () => ({
        studentId,
        teacherId,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      })),
    });

    const assignment = await getStudentTeacherAssignment(store, studentId);
    expect(assignment.teacherId).toBe(teacherId);
  });

  it('throws when assignment is missing', async () => {
    const studentId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      findByStudentId: vi.fn(async () => null),
    });

    await expect(
      getStudentTeacherAssignment(store, studentId),
    ).rejects.toBeInstanceOf(AssignmentNotFoundError);
  });
});

describe('unassignTeacherFromStudent', () => {
  it('removes an existing assignment', async () => {
    const studentId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      deleteByStudentId: vi.fn(async () => true),
    });

    await unassignTeacherFromStudent(store, studentId);
    expect(store.deleteByStudentId).toHaveBeenCalledWith(studentId);
  });

  it('throws when nothing to remove', async () => {
    const studentId = randomUUID();
    const store = createStore({
      findStudent: vi.fn(async () => ({
        id: studentId,
        userId: randomUUID(),
        isActive: true,
      })),
      deleteByStudentId: vi.fn(async () => false),
    });

    await expect(
      unassignTeacherFromStudent(store, studentId),
    ).rejects.toBeInstanceOf(AssignmentNotFoundError);
  });
});
