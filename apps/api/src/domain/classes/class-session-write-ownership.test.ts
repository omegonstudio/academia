import { beforeEach, describe, expect, it } from 'vitest';
import {
  ClassSessionForbiddenError,
  createClassSession,
  deleteClassSession,
  updateClassSession,
} from './class-session-service.js';
import { createInMemoryClassSessionStore } from './in-memory-class-session-store.js';

describe('class-session write ownership', () => {
  const groupA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const groupB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const teacherA = '11111111-1111-4111-8111-111111111111';
  const teacherB = '22222222-2222-4222-8222-222222222222';

  let store = createInMemoryClassSessionStore();

  beforeEach(() => {
    store = createInMemoryClassSessionStore();
    store.seedGroupContext({
      id: groupA,
      isActive: true,
      teacherId: teacherA,
      scheduleOptionId: '33333333-3333-4333-8333-333333333333',
      serviceType: 'GROUP_120',
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: 'MONDAY',
      scheduleStartTime: '18:00',
    });
    store.seedGroupContext({
      id: groupB,
      isActive: true,
      teacherId: teacherB,
      scheduleOptionId: '44444444-4444-4444-8444-444444444444',
      serviceType: 'GROUP_120',
      courseIsActive: true,
      scheduleOptionActive: true,
      scheduleDay: 'TUESDAY',
      scheduleStartTime: '18:00',
    });
  });

  it('lets a group teacher create/update/delete own sessions', async () => {
    const created = await createClassSession(
      store,
      { groupId: groupA, startAt: '2026-09-21T21:00:00.000Z' },
      { mode: 'teacher', teacherId: teacherA },
    );
    expect(created.groupId).toBe(groupA);

    const updated = await updateClassSession(
      store,
      created.id,
      { meetingUrl: 'https://meet.example.com/a' },
      { mode: 'teacher', teacherId: teacherA },
    );
    expect(updated.meetingUrl).toBe('https://meet.example.com/a');

    const removed = await deleteClassSession(store, created.id, {
      mode: 'teacher',
      teacherId: teacherA,
    });
    expect(removed.isActive).toBe(false);
  });

  it('forbids a teacher from mutating another teacher group', async () => {
    await expect(
      createClassSession(
        store,
        { groupId: groupA, startAt: '2026-09-21T21:00:00.000Z' },
        { mode: 'teacher', teacherId: teacherB },
      ),
    ).rejects.toBeInstanceOf(ClassSessionForbiddenError);

    const owned = await createClassSession(
      store,
      { groupId: groupA, startAt: '2026-09-22T21:00:00.000Z' },
      { mode: 'admin' },
    );

    await expect(
      updateClassSession(
        store,
        owned.id,
        { isActive: false },
        { mode: 'teacher', teacherId: teacherB },
      ),
    ).rejects.toBeInstanceOf(ClassSessionForbiddenError);

    await expect(
      deleteClassSession(store, owned.id, {
        mode: 'teacher',
        teacherId: teacherB,
      }),
    ).rejects.toBeInstanceOf(ClassSessionForbiddenError);
  });
});
