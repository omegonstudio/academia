import { beforeEach, describe, expect, it } from 'vitest';
import {
  AttendanceAlreadyExistsError,
  AttendanceForbiddenError,
  AttendanceNotFoundError,
  AttendanceValidationError,
  createAttendance,
  listAttendanceForClassSession,
  updateAttendance,
} from './attendance-service.js';
import { createInMemoryAttendanceStore } from './in-memory-attendance-store.js';

describe('attendance service', () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const otherSessionId = '22222222-2222-4222-8222-222222222222';
  const groupId = '33333333-3333-4333-8333-333333333333';
  const teacherId = '44444444-4444-4444-8444-444444444444';
  const studentId = '55555555-5555-4555-8555-555555555555';
  const outsiderId = '66666666-6666-4666-8666-666666666666';

  let enrolled = new Set<string>([`${groupId}:${studentId}`]);
  let sessions = new Map([
    [
      sessionId,
      {
        id: sessionId,
        groupId,
        isActive: true,
        teacherId,
      },
    ],
    [
      otherSessionId,
      {
        id: otherSessionId,
        groupId: '77777777-7777-4777-8777-777777777777',
        isActive: true,
        teacherId: '88888888-8888-4888-8888-888888888888',
      },
    ],
  ]);
  let students = new Map([
    [
      studentId,
      {
        id: studentId,
        firstName: 'Ana',
        lastName: 'Lopez',
        isActive: true,
      },
    ],
    [
      outsiderId,
      {
        id: outsiderId,
        firstName: 'Bob',
        lastName: 'Perez',
        isActive: true,
      },
    ],
  ]);
  let store = createInMemoryAttendanceStore({
    findClassSession: async (id) => sessions.get(id) ?? null,
    findStudent: async (id) => students.get(id) ?? null,
    hasActiveEnrollment: async (g, s) => enrolled.has(`${g}:${s}`),
  });

  beforeEach(() => {
    enrolled = new Set([`${groupId}:${studentId}`]);
    sessions = new Map([
      [
        sessionId,
        {
          id: sessionId,
          groupId,
          isActive: true,
          teacherId,
        },
      ],
      [
        otherSessionId,
        {
          id: otherSessionId,
          groupId: '77777777-7777-4777-8777-777777777777',
          isActive: true,
          teacherId: '88888888-8888-4888-8888-888888888888',
        },
      ],
    ]);
    students = new Map([
      [
        studentId,
        {
          id: studentId,
          firstName: 'Ana',
          lastName: 'Lopez',
          isActive: true,
        },
      ],
      [
        outsiderId,
        {
          id: outsiderId,
          firstName: 'Bob',
          lastName: 'Perez',
          isActive: true,
        },
      ],
    ]);
    store = createInMemoryAttendanceStore({
      findClassSession: async (id) => sessions.get(id) ?? null,
      findStudent: async (id) => students.get(id) ?? null,
      hasActiveEnrollment: async (g, s) => enrolled.has(`${g}:${s}`),
    });
  });

  it('creates PRESENT and ABSENT for an actively enrolled student', async () => {
    const present = await createAttendance(
      store,
      sessionId,
      { studentId, status: 'PRESENT' },
      { mode: 'admin' },
    );
    expect(present.status).toBe('PRESENT');
    expect(present.student.firstName).toBe('Ana');

    await expect(
      createAttendance(
        store,
        sessionId,
        { studentId, status: 'ABSENT' },
        { mode: 'admin' },
      ),
    ).rejects.toBeInstanceOf(AttendanceAlreadyExistsError);

    const updated = await updateAttendance(
      store,
      sessionId,
      studentId,
      { status: 'ABSENT' },
      { mode: 'admin' },
    );
    expect(updated.status).toBe('ABSENT');
  });

  it('rejects students without active enrollment and inactive sessions', async () => {
    await expect(
      createAttendance(
        store,
        sessionId,
        { studentId: outsiderId, status: 'PRESENT' },
        { mode: 'admin' },
      ),
    ).rejects.toBeInstanceOf(AttendanceValidationError);

    sessions.set(sessionId, {
      id: sessionId,
      groupId,
      isActive: false,
      teacherId,
    });
    await expect(
      createAttendance(
        store,
        sessionId,
        { studentId, status: 'PRESENT' },
        { mode: 'admin' },
      ),
    ).rejects.toBeInstanceOf(AttendanceValidationError);
  });

  it('rejects write after unenroll while keeping existing rows readable', async () => {
    await createAttendance(
      store,
      sessionId,
      { studentId, status: 'PRESENT' },
      { mode: 'admin' },
    );
    enrolled.delete(`${groupId}:${studentId}`);

    await expect(
      updateAttendance(
        store,
        sessionId,
        studentId,
        { status: 'ABSENT' },
        { mode: 'admin' },
      ),
    ).rejects.toBeInstanceOf(AttendanceValidationError);

    const listed = await listAttendanceForClassSession(store, sessionId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe('PRESENT');
  });

  it('enforces teacher ownership on writes', async () => {
    await expect(
      createAttendance(
        store,
        sessionId,
        { studentId, status: 'PRESENT' },
        { mode: 'teacher', teacherId: '99999999-9999-4999-8999-999999999999' },
      ),
    ).rejects.toBeInstanceOf(AttendanceForbiddenError);

    const created = await createAttendance(
      store,
      sessionId,
      { studentId, status: 'PRESENT' },
      { mode: 'teacher', teacherId },
    );
    expect(created.status).toBe('PRESENT');
  });

  it('scopes student list filter and rejects missing session', async () => {
    await createAttendance(
      store,
      sessionId,
      { studentId, status: 'PRESENT' },
      { mode: 'admin' },
    );

    const self = await listAttendanceForClassSession(store, sessionId, {
      studentId,
    });
    expect(self).toHaveLength(1);

    const empty = await listAttendanceForClassSession(store, sessionId, {
      studentId: outsiderId,
    });
    expect(empty).toHaveLength(0);

    await expect(
      listAttendanceForClassSession(
        store,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
    ).rejects.toBeInstanceOf(AttendanceNotFoundError);
  });
});
