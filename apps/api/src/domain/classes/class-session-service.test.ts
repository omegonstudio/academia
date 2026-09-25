import { describe, expect, it } from 'vitest';
import {
  ClassSessionValidationError,
  createClassSession,
  deleteClassSession,
  generateClassSessionsForGroup,
  getClassSession,
  listClassSessions,
  updateClassSession,
} from './class-session-service.js';
import { createInMemoryClassSessionStore } from './in-memory-class-session-store.js';

const ACADEMY = { businessTimezone: 'America/Argentina/Buenos_Aires' };

describe('class-session-service', () => {
  function setup(serviceType: 'ONE_TO_ONE_60' | 'ONE_TO_ONE_90' | 'GROUP_120') {
    const store = createInMemoryClassSessionStore();
    store.seedGroupContext({
      id: 'group-1',
      isActive: true,
      teacherId: 'teacher-1',
      scheduleOptionId: 'option-1',
      serviceType,
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: 'MONDAY',
      scheduleStartTime: '18:00',
    });
    return store;
  }

  it('derives endAt from ONE_TO_ONE_60 / 90 / GROUP_120', async () => {
    const startAt = '2026-09-21T18:00:00.000Z';

    const sixty = await createClassSession(setup('ONE_TO_ONE_60'), {
      groupId: 'group-1',
      startAt,
    });
    expect(sixty.durationMinutes).toBe(60);
    expect(sixty.endAt).toBe('2026-09-21T19:00:00.000Z');

    const ninety = await createClassSession(setup('ONE_TO_ONE_90'), {
      groupId: 'group-1',
      startAt,
    });
    expect(ninety.durationMinutes).toBe(90);
    expect(ninety.endAt).toBe('2026-09-21T19:30:00.000Z');

    const group = await createClassSession(setup('GROUP_120'), {
      groupId: 'group-1',
      startAt,
    });
    expect(group.durationMinutes).toBe(120);
    expect(group.endAt).toBe('2026-09-21T20:00:00.000Z');
  });

  it('rejects missing schedule option and inactive group', async () => {
    const store = createInMemoryClassSessionStore();
    store.seedGroupContext({
      id: 'group-1',
      isActive: true,
      teacherId: null,
      scheduleOptionId: null,
      serviceType: 'GROUP_120',
      courseIsActive: true,
      scheduleOptionActive: null,
      scheduleDay: null,
      scheduleStartTime: null,
    });

    await expect(
      createClassSession(store, {
        groupId: 'group-1',
        startAt: '2026-09-21T18:00:00.000Z',
      }),
    ).rejects.toThrow(/schedule option/);

    store.seedGroupContext({
      id: 'group-2',
      isActive: false,
      teacherId: null,
      scheduleOptionId: 'option-1',
      serviceType: 'GROUP_120',
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: 'MONDAY',
      scheduleStartTime: '18:00',
    });
    await expect(
      createClassSession(store, {
        groupId: 'group-2',
        startAt: '2026-09-21T18:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ClassSessionValidationError);
  });

  it('lists, updates startAt and soft-deletes', async () => {
    const store = setup('GROUP_120');
    const created = await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-09-21T18:00:00.000Z',
    });

    expect(await listClassSessions(store)).toHaveLength(1);
    expect((await getClassSession(store, created.id)).id).toBe(created.id);

    const updated = await updateClassSession(store, created.id, {
      startAt: '2026-09-28T18:00:00.000Z',
    });
    expect(updated.startAt).toBe('2026-09-28T18:00:00.000Z');
    expect(updated.endAt).toBe('2026-09-28T20:00:00.000Z');

    const removed = await deleteClassSession(store, created.id);
    expect(removed.isActive).toBe(false);
  });

  it('generates weekly sessions in academy timezone with derived duration', async () => {
    // 2026-09-14 → 2026-10-11 inclusive: Mondays 14, 21, 28 Sep + 5 Oct = 4
    const store = setup('GROUP_120');
    const result = await generateClassSessionsForGroup(
      store,
      'group-1',
      { from: '2026-09-14', to: '2026-10-11' },
      ACADEMY,
    );

    expect(result.generatedCount).toBe(4);
    expect(result.skippedCount).toBe(0);
    expect(result.conflictCount).toBe(0);
    expect(result.classSessions).toHaveLength(4);
    // Local Monday 18:00 America/Argentina/Buenos_Aires = 21:00Z
    expect(result.classSessions[0]!.startAt).toBe('2026-09-14T21:00:00.000Z');
    expect(result.classSessions[0]!.endAt).toBe('2026-09-14T23:00:00.000Z');
    expect(result.classSessions[0]!.durationMinutes).toBe(120);
    expect(result.classSessions.map((s) => s.startAt)).toEqual([
      '2026-09-14T21:00:00.000Z',
      '2026-09-21T21:00:00.000Z',
      '2026-09-28T21:00:00.000Z',
      '2026-10-05T21:00:00.000Z',
    ]);
  });

  it('derives 60 and 90 minute windows when generating', async () => {
    const sixty = await generateClassSessionsForGroup(
      setup('ONE_TO_ONE_60'),
      'group-1',
      { from: '2026-09-21', to: '2026-09-21' },
      ACADEMY,
    );
    expect(sixty.classSessions[0]!.endAt).toBe('2026-09-21T22:00:00.000Z');

    const ninety = await generateClassSessionsForGroup(
      setup('ONE_TO_ONE_90'),
      'group-1',
      { from: '2026-09-21', to: '2026-09-21' },
      ACADEMY,
    );
    expect(ninety.classSessions[0]!.endAt).toBe('2026-09-21T22:30:00.000Z');
  });

  it('is idempotent on repeated generate for the same range', async () => {
    const store = setup('GROUP_120');
    const first = await generateClassSessionsForGroup(
      store,
      'group-1',
      { from: '2026-09-14', to: '2026-10-11' },
      ACADEMY,
    );
    const second = await generateClassSessionsForGroup(
      store,
      'group-1',
      { from: '2026-09-14', to: '2026-10-11' },
      ACADEMY,
    );

    expect(first.generatedCount).toBe(4);
    expect(second.generatedCount).toBe(0);
    expect(second.skippedCount).toBe(4);
    expect(second.conflictCount).toBe(0);
    expect(await listClassSessions(store)).toHaveLength(4);
  });

  it('rejects generate when group inactive, course inactive, or schedule missing', async () => {
    const store = createInMemoryClassSessionStore();
    store.seedGroupContext({
      id: 'group-1',
      isActive: false,
      teacherId: null,
      scheduleOptionId: 'option-1',
      serviceType: 'GROUP_120',
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: 'MONDAY',
      scheduleStartTime: '18:00',
    });
    await expect(
      generateClassSessionsForGroup(
        store,
        'group-1',
        { from: '2026-09-14', to: '2026-09-21' },
        ACADEMY,
      ),
    ).rejects.toThrow(/inactive/);

    store.seedGroupContext({
      id: 'group-2',
      isActive: true,
      teacherId: null,
      scheduleOptionId: 'option-1',
      serviceType: 'GROUP_120',
      courseIsActive: false,
      scheduleOptionActive: true,
      scheduleDay: 'MONDAY',
      scheduleStartTime: '18:00',
    });
    await expect(
      generateClassSessionsForGroup(
        store,
        'group-2',
        { from: '2026-09-14', to: '2026-09-21' },
        ACADEMY,
      ),
    ).rejects.toThrow(/Course is inactive/);

    store.seedGroupContext({
      id: 'group-3',
      isActive: true,
      teacherId: null,
      scheduleOptionId: null,
      serviceType: 'GROUP_120',
      courseIsActive: true,
      scheduleOptionActive: null,
      scheduleDay: null,
      scheduleStartTime: null,
    });
    await expect(
      generateClassSessionsForGroup(
        store,
        'group-3',
        { from: '2026-09-14', to: '2026-09-21' },
        ACADEMY,
      ),
    ).rejects.toThrow(/schedule option/);
  });

  it('rejects ranges longer than 90 days', async () => {
    await expect(
      generateClassSessionsForGroup(
        setup('GROUP_120'),
        'group-1',
        { from: '2026-01-01', to: '2026-04-15' },
        ACADEMY,
      ),
    ).rejects.toThrow(/90 days/);
  });
});
