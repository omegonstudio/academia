import { describe, expect, it } from 'vitest';
import {
  ClassSessionForbiddenError,
  createClassSession,
  getClassSession,
  listClassSessions,
  listClassSessionsForCalendar,
} from './class-session-service.js';
import { createInMemoryClassSessionStore } from './in-memory-class-session-store.js';

const ACADEMY = { businessTimezone: 'America/Argentina/Buenos_Aires' };

describe('class-session read ownership', () => {
  function setup() {
    const enrollments = new Set<string>();
    const store = createInMemoryClassSessionStore({
      hasActiveEnrollment: async (groupId, studentId) =>
        enrollments.has(`${groupId}:${studentId}`),
    });

    store.seedGroupContext({
      id: 'group-a',
      isActive: true,
      teacherId: 'teacher-a',
      scheduleOptionId: 'option-1',
      serviceType: 'ONE_TO_ONE_60',
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: 'MONDAY',
      scheduleStartTime: '10:00',
    });
    store.seedGroupContext({
      id: 'group-b',
      isActive: true,
      teacherId: 'teacher-b',
      scheduleOptionId: 'option-2',
      serviceType: 'ONE_TO_ONE_60',
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: 'MONDAY',
      scheduleStartTime: '12:00',
    });
    store.seedCalendarGroup({
      id: 'group-a',
      name: 'Group A',
      course: {
        id: 'course-a',
        name: 'Course A',
        serviceType: 'ONE_TO_ONE_60',
        courseType: 'REGULAR',
      },
      teacher: { id: 'teacher-a', firstName: 'Ana', lastName: 'A' },
    });
    store.seedCalendarGroup({
      id: 'group-b',
      name: 'Group B',
      course: {
        id: 'course-b',
        name: 'Course B',
        serviceType: 'ONE_TO_ONE_60',
        courseType: 'REGULAR',
      },
      teacher: { id: 'teacher-b', firstName: 'Bob', lastName: 'B' },
    });

    return {
      store,
      enroll(groupId: string, studentId: string) {
        enrollments.add(`${groupId}:${studentId}`);
      },
      unenroll(groupId: string, studentId: string) {
        enrollments.delete(`${groupId}:${studentId}`);
      },
    };
  }

  it('scopes list/get/calendar to Group.teacherId for teachers', async () => {
    const { store } = setup();
    const a = await createClassSession(store, {
      groupId: 'group-a',
      startAt: '2026-09-14T13:00:00.000Z',
    });
    await createClassSession(store, {
      groupId: 'group-b',
      startAt: '2026-09-14T15:00:00.000Z',
    });

    const listed = await listClassSessions(store, {
      scope: { mode: 'teacher', teacherId: 'teacher-a' },
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(a.id);

    await expect(
      getClassSession(store, a.id, {
        mode: 'teacher',
        teacherId: 'teacher-a',
      }),
    ).resolves.toMatchObject({ id: a.id });

    await expect(
      getClassSession(store, a.id, {
        mode: 'teacher',
        teacherId: 'teacher-b',
      }),
    ).rejects.toBeInstanceOf(ClassSessionForbiddenError);

    const calendar = await listClassSessionsForCalendar(
      store,
      { from: '2026-09-01', to: '2026-09-30' },
      ACADEMY,
      { mode: 'teacher', teacherId: 'teacher-a' },
    );
    expect(calendar.classSessions).toHaveLength(1);
    expect(calendar.classSessions[0]!.group.id).toBe('group-a');
  });

  it('scopes student reads to active enrollments only', async () => {
    const { store, enroll, unenroll } = setup();
    const session = await createClassSession(store, {
      groupId: 'group-a',
      startAt: '2026-09-14T13:00:00.000Z',
    });
    await createClassSession(store, {
      groupId: 'group-b',
      startAt: '2026-09-14T15:00:00.000Z',
    });

    enroll('group-a', 'student-1');

    const listed = await listClassSessions(store, {
      scope: { mode: 'student', studentId: 'student-1' },
    });
    expect(listed.map((s) => s.id)).toEqual([session.id]);

    await expect(
      getClassSession(store, session.id, {
        mode: 'student',
        studentId: 'student-1',
      }),
    ).resolves.toMatchObject({ id: session.id });

    unenroll('group-a', 'student-1');
    await expect(
      getClassSession(store, session.id, {
        mode: 'student',
        studentId: 'student-1',
      }),
    ).rejects.toBeInstanceOf(ClassSessionForbiddenError);

    expect(
      await listClassSessions(store, {
        scope: { mode: 'student', studentId: 'student-1' },
      }),
    ).toEqual([]);
  });

  it('unrestricted scope still returns all sessions', async () => {
    const { store } = setup();
    await createClassSession(store, {
      groupId: 'group-a',
      startAt: '2026-09-14T13:00:00.000Z',
    });
    await createClassSession(store, {
      groupId: 'group-b',
      startAt: '2026-09-14T15:00:00.000Z',
    });
    expect(
      await listClassSessions(store, { scope: { mode: 'all' } }),
    ).toHaveLength(2);
  });
});
