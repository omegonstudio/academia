import { describe, expect, it } from 'vitest';
import {
  ClassSessionConflictError,
  createClassSession,
  generateClassSessionsForGroup,
  intervalsOverlap,
  updateClassSession,
} from './class-session-service.js';
import { createInMemoryClassSessionStore } from './in-memory-class-session-store.js';

const ACADEMY = { businessTimezone: 'America/Argentina/Buenos_Aires' };

describe('intervalsOverlap', () => {
  function interval(start: string, end: string) {
    return { startAt: new Date(start), endAt: new Date(end) };
  }

  it('detects overlap, containment, same start/end; allows adjacent', () => {
    expect(
      intervalsOverlap(
        interval('2026-09-21T10:00:00.000Z', '2026-09-21T11:00:00.000Z'),
        interval('2026-09-21T10:30:00.000Z', '2026-09-21T11:30:00.000Z'),
      ),
    ).toBe(true);

    expect(
      intervalsOverlap(
        interval('2026-09-21T10:00:00.000Z', '2026-09-21T12:00:00.000Z'),
        interval('2026-09-21T11:00:00.000Z', '2026-09-21T11:30:00.000Z'),
      ),
    ).toBe(true);

    expect(
      intervalsOverlap(
        interval('2026-09-21T10:00:00.000Z', '2026-09-21T11:00:00.000Z'),
        interval('2026-09-21T10:00:00.000Z', '2026-09-21T12:00:00.000Z'),
      ),
    ).toBe(true);

    expect(
      intervalsOverlap(
        interval('2026-09-21T10:00:00.000Z', '2026-09-21T11:00:00.000Z'),
        interval('2026-09-21T09:00:00.000Z', '2026-09-21T11:00:00.000Z'),
      ),
    ).toBe(true);

    expect(
      intervalsOverlap(
        interval('2026-09-21T10:00:00.000Z', '2026-09-21T11:00:00.000Z'),
        interval('2026-09-21T11:00:00.000Z', '2026-09-21T12:00:00.000Z'),
      ),
    ).toBe(false);
  });
});

describe('class-session teacher conflict detection', () => {
  function seedGroup(
    store: ReturnType<typeof createInMemoryClassSessionStore>,
    opts: {
      id: string;
      teacherId: string;
      serviceType?: 'ONE_TO_ONE_60' | 'ONE_TO_ONE_90' | 'GROUP_120';
      scheduleDay?: 'MONDAY' | 'TUESDAY';
      scheduleStartTime?: string;
    },
  ) {
    store.seedGroupContext({
      id: opts.id,
      isActive: true,
      teacherId: opts.teacherId,
      scheduleOptionId: `option-${opts.id}`,
      serviceType: opts.serviceType ?? 'ONE_TO_ONE_60',
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: opts.scheduleDay ?? 'MONDAY',
      scheduleStartTime: opts.scheduleStartTime ?? '18:00',
    });
  }

  it('allows the same absolute window for two different teachers', async () => {
    const store = createInMemoryClassSessionStore();
    seedGroup(store, { id: 'group-a', teacherId: 'teacher-a' });
    seedGroup(store, { id: 'group-b', teacherId: 'teacher-b' });

    await createClassSession(store, {
      groupId: 'group-a',
      startAt: '2026-09-21T10:00:00.000Z',
    });
    await expect(
      createClassSession(store, {
        groupId: 'group-b',
        startAt: '2026-09-21T10:00:00.000Z',
      }),
    ).resolves.toMatchObject({ teacherId: 'teacher-b' });
  });

  it('rejects overlapping / contained / same-edge sessions for one teacher', async () => {
    const store = createInMemoryClassSessionStore();
    seedGroup(store, { id: 'group-a', teacherId: 'teacher-1' });
    seedGroup(store, {
      id: 'group-b',
      teacherId: 'teacher-1',
      serviceType: 'ONE_TO_ONE_90',
    });

    await createClassSession(store, {
      groupId: 'group-a',
      startAt: '2026-09-21T10:00:00.000Z',
    });

    // 10:00–11:00 vs 10:30–11:30
    await expect(
      createClassSession(store, {
        groupId: 'group-b',
        startAt: '2026-09-21T10:30:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ClassSessionConflictError);

    // containment via longer service on another group: seed ONE_TO_ONE_60 at 11:00
    // inside a GROUP_120 window — create GROUP_120 first instead
    const contained = createInMemoryClassSessionStore();
    seedGroup(contained, {
      id: 'group-wide',
      teacherId: 'teacher-1',
      serviceType: 'GROUP_120',
    });
    seedGroup(contained, {
      id: 'group-narrow',
      teacherId: 'teacher-1',
      serviceType: 'ONE_TO_ONE_60',
    });
    await createClassSession(contained, {
      groupId: 'group-wide',
      startAt: '2026-09-21T10:00:00.000Z',
    });
    await expect(
      createClassSession(contained, {
        groupId: 'group-narrow',
        startAt: '2026-09-21T11:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ClassSessionConflictError);

    // same start
    const sameStart = createInMemoryClassSessionStore();
    seedGroup(sameStart, { id: 'g1', teacherId: 't1' });
    seedGroup(sameStart, {
      id: 'g2',
      teacherId: 't1',
      serviceType: 'ONE_TO_ONE_90',
    });
    await createClassSession(sameStart, {
      groupId: 'g1',
      startAt: '2026-09-21T10:00:00.000Z',
    });
    await expect(
      createClassSession(sameStart, {
        groupId: 'g2',
        startAt: '2026-09-21T10:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ClassSessionConflictError);

    // same end: 09:00–10:00 (60) vs 09:00–10:30 would be same start;
    // 09:00–10:00 vs 08:30–09:30 with 60-min: use 09:00–10:00 and 08:00–09:00 adjacent OK;
    // same end: 09:00–10:00 and 08:00–10:00 needs 120 on second
    const sameEnd = createInMemoryClassSessionStore();
    seedGroup(sameEnd, { id: 'g1', teacherId: 't1' });
    seedGroup(sameEnd, {
      id: 'g2',
      teacherId: 't1',
      serviceType: 'GROUP_120',
    });
    await createClassSession(sameEnd, {
      groupId: 'g1',
      startAt: '2026-09-21T10:00:00.000Z',
    });
    await expect(
      createClassSession(sameEnd, {
        groupId: 'g2',
        startAt: '2026-09-21T09:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ClassSessionConflictError);
  });

  it('allows adjacent sessions for the same teacher', async () => {
    const store = createInMemoryClassSessionStore();
    seedGroup(store, { id: 'group-a', teacherId: 'teacher-1' });
    seedGroup(store, { id: 'group-b', teacherId: 'teacher-1' });

    await createClassSession(store, {
      groupId: 'group-a',
      startAt: '2026-09-21T10:00:00.000Z',
    });
    await expect(
      createClassSession(store, {
        groupId: 'group-b',
        startAt: '2026-09-21T11:00:00.000Z',
      }),
    ).resolves.toMatchObject({ startAt: '2026-09-21T11:00:00.000Z' });
  });

  it('excludes the session itself on PATCH and rejects moves into conflict', async () => {
    const store = createInMemoryClassSessionStore();
    seedGroup(store, { id: 'group-a', teacherId: 'teacher-1' });
    seedGroup(store, { id: 'group-b', teacherId: 'teacher-1' });

    const first = await createClassSession(store, {
      groupId: 'group-a',
      startAt: '2026-09-21T10:00:00.000Z',
    });
    await createClassSession(store, {
      groupId: 'group-b',
      startAt: '2026-09-21T12:00:00.000Z',
    });

    await expect(
      updateClassSession(store, first.id, {
        startAt: '2026-09-21T10:00:00.000Z',
      }),
    ).resolves.toMatchObject({ id: first.id });

    await expect(
      updateClassSession(store, first.id, {
        startAt: '2026-09-21T11:30:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ClassSessionConflictError);
  });

  it('generate reports created, existing and conflicts separately', async () => {
    const store = createInMemoryClassSessionStore();
    // Target group: Mondays 18:00 local → 21:00Z, GROUP_120 → 23:00Z
    seedGroup(store, {
      id: 'group-gen',
      teacherId: 'teacher-1',
      serviceType: 'GROUP_120',
      scheduleDay: 'MONDAY',
      scheduleStartTime: '18:00',
    });
    // Other group same teacher: blocks 2026-09-21 21:00–22:00Z (overlaps 21:00–23:00)
    seedGroup(store, {
      id: 'group-other',
      teacherId: 'teacher-1',
      serviceType: 'ONE_TO_ONE_60',
    });

    // Pre-create one generated Monday as existing (14 Sep)
    await createClassSession(store, {
      groupId: 'group-gen',
      startAt: '2026-09-14T21:00:00.000Z',
    });
    // Conflict on 21 Sep
    await createClassSession(store, {
      groupId: 'group-other',
      startAt: '2026-09-21T21:00:00.000Z',
    });

    const result = await generateClassSessionsForGroup(
      store,
      'group-gen',
      { from: '2026-09-14', to: '2026-10-11' },
      ACADEMY,
    );

    // Mondays: 14 (existing), 21 (conflict), 28 + 5 Oct (created) = 2 created
    expect(result.generatedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.conflictCount).toBe(1);
    expect(result.classSessions.map((s) => s.startAt)).toEqual([
      '2026-09-28T21:00:00.000Z',
      '2026-10-05T21:00:00.000Z',
    ]);
  });
});
