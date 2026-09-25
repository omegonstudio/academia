import { describe, expect, it } from 'vitest';
import {
  ClassSessionValidationError,
  createClassSession,
  deleteClassSession,
  listClassSessionsForCalendar,
} from './class-session-service.js';
import { createInMemoryClassSessionStore } from './in-memory-class-session-store.js';

const ACADEMY = { businessTimezone: 'America/Argentina/Buenos_Aires' };

describe('listClassSessionsForCalendar', () => {
  function setup() {
    const store = createInMemoryClassSessionStore();
    store.seedGroupContext({
      id: 'group-1',
      isActive: true,
      teacherId: 'teacher-1',
      scheduleOptionId: 'option-1',
      serviceType: 'GROUP_120',
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: 'MONDAY',
      scheduleStartTime: '18:00',
    });
    store.seedCalendarGroup({
      id: 'group-1',
      name: 'Grupo A',
      course: {
        id: 'course-1',
        name: 'Español Regular',
        serviceType: 'GROUP_120',
        courseType: 'REGULAR',
      },
      teacher: {
        id: 'teacher-1',
        firstName: 'Eva',
        lastName: 'Ruiz',
      },
    });
    return store;
  }

  it('returns active sessions inside the academy-local civil range, ordered', async () => {
    const store = setup();
    // Local Sep 14 18:00 ART → 21:00Z; Sep 21; Oct 5 (outside September)
    await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-09-14T21:00:00.000Z',
    });
    await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-09-21T21:00:00.000Z',
    });
    await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-10-05T21:00:00.000Z',
    });

    const result = await listClassSessionsForCalendar(
      store,
      { from: '2026-09-01', to: '2026-09-30' },
      ACADEMY,
    );

    expect(result.from).toBe('2026-09-01');
    expect(result.to).toBe('2026-09-30');
    expect(result.classSessions).toHaveLength(2);
    expect(result.classSessions.map((s) => s.startAt)).toEqual([
      '2026-09-14T21:00:00.000Z',
      '2026-09-21T21:00:00.000Z',
    ]);
    expect(result.classSessions[0]).toMatchObject({
      durationMinutes: 120,
      group: {
        id: 'group-1',
        name: 'Grupo A',
        course: {
          id: 'course-1',
          name: 'Español Regular',
          serviceType: 'GROUP_120',
          courseType: 'REGULAR',
        },
      },
      teacher: { id: 'teacher-1', firstName: 'Eva', lastName: 'Ruiz' },
    });
  });

  it('excludes inactive sessions and returns empty arrays for empty ranges', async () => {
    const store = setup();
    const created = await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-09-14T21:00:00.000Z',
    });
    await deleteClassSession(store, created.id);

    const empty = await listClassSessionsForCalendar(
      store,
      { from: '2026-09-01', to: '2026-09-30' },
      ACADEMY,
    );
    expect(empty.classSessions).toEqual([]);
  });

  it('rejects inverted and oversized ranges', async () => {
    const store = setup();
    await expect(
      listClassSessionsForCalendar(
        store,
        { from: '2026-09-30', to: '2026-09-01' },
        ACADEMY,
      ),
    ).rejects.toBeInstanceOf(ClassSessionValidationError);

    await expect(
      listClassSessionsForCalendar(
        store,
        { from: '2026-01-01', to: '2026-05-01' },
        ACADEMY,
      ),
    ).rejects.toBeInstanceOf(ClassSessionValidationError);
  });

  it('interprets civil bounds in academy timezone, not process TZ', async () => {
    const previous = process.env['TZ'];
    process.env['TZ'] = 'Pacific/Auckland';
    try {
      const store = createInMemoryClassSessionStore();
      for (const [id, teacherId] of [
        ['group-1', 'teacher-1'],
        ['group-2', 'teacher-2'],
      ] as const) {
        store.seedGroupContext({
          id,
          isActive: true,
          teacherId,
          scheduleOptionId: `option-${id}`,
          serviceType: 'ONE_TO_ONE_60',
          courseIsActive: true,
          scheduleOptionActive: true,
          scheduleDay: 'MONDAY',
          scheduleStartTime: '00:00',
        });
        store.seedCalendarGroup({
          id,
          name: id,
          course: {
            id: `course-${id}`,
            name: 'Course',
            serviceType: 'ONE_TO_ONE_60',
            courseType: 'REGULAR',
          },
          teacher: {
            id: teacherId,
            firstName: 'A',
            lastName: 'B',
          },
        });
      }

      // 2026-09-01 00:00 ART = 2026-09-01T03:00:00.000Z
      await createClassSession(store, {
        groupId: 'group-1',
        startAt: '2026-09-01T02:59:00.000Z',
      });
      await createClassSession(store, {
        groupId: 'group-2',
        startAt: '2026-09-01T03:00:00.000Z',
      });

      const result = await listClassSessionsForCalendar(
        store,
        { from: '2026-09-01', to: '2026-09-01' },
        ACADEMY,
      );
      expect(result.classSessions).toHaveLength(1);
      expect(result.classSessions[0]!.startAt).toBe('2026-09-01T03:00:00.000Z');
    } finally {
      if (previous === undefined) {
        delete process.env['TZ'];
      } else {
        process.env['TZ'] = previous;
      }
    }
  });
});
