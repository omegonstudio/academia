import { describe, expect, it } from 'vitest';
import { meetingUrlSchema } from '@academia/shared';
import {
  createClassSession,
  generateClassSessionsForGroup,
  updateClassSession,
} from './class-session-service.js';
import { createInMemoryClassSessionStore } from './in-memory-class-session-store.js';

const ACADEMY = { businessTimezone: 'America/Argentina/Buenos_Aires' };

describe('meetingUrlSchema', () => {
  it('accepts absolute https meeting URLs', () => {
    expect(
      meetingUrlSchema.safeParse('https://meet.google.com/abc-defg-hij')
        .success,
    ).toBe(true);
    expect(meetingUrlSchema.safeParse('https://zoom.us/j/123456').success).toBe(
      true,
    );
  });

  it('rejects insecure or non-https schemes', () => {
    expect(meetingUrlSchema.safeParse('http://meet.google.com/x').success).toBe(
      false,
    );
    expect(meetingUrlSchema.safeParse('javascript:alert(1)').success).toBe(
      false,
    );
    expect(meetingUrlSchema.safeParse('data:text/html,hi').success).toBe(false);
    expect(meetingUrlSchema.safeParse('file:///tmp/x').success).toBe(false);
    expect(meetingUrlSchema.safeParse('not-a-url').success).toBe(false);
  });
});

describe('class-session meetingUrl', () => {
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
    return store;
  }

  it('creates with optional meetingUrl and defaults to null', async () => {
    const store = setup();
    const without = await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-09-14T21:00:00.000Z',
    });
    expect(without.meetingUrl).toBeNull();

    const withUrl = await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-09-21T21:00:00.000Z',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });
    expect(withUrl.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('patches add/replace/clear meetingUrl without rescheduling', async () => {
    const store = setup();
    const created = await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-09-14T21:00:00.000Z',
    });

    const added = await updateClassSession(store, created.id, {
      meetingUrl: 'https://zoom.us/j/111',
    });
    expect(added.meetingUrl).toBe('https://zoom.us/j/111');
    expect(added.startAt).toBe(created.startAt);
    expect(added.endAt).toBe(created.endAt);

    const replaced = await updateClassSession(store, created.id, {
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/x',
    });
    expect(replaced.meetingUrl).toBe(
      'https://teams.microsoft.com/l/meetup-join/x',
    );

    const cleared = await updateClassSession(store, created.id, {
      meetingUrl: null,
    });
    expect(cleared.meetingUrl).toBeNull();
    expect(cleared.startAt).toBe(created.startAt);
  });

  it('generate leaves meetingUrl null', async () => {
    const store = setup();
    const result = await generateClassSessionsForGroup(
      store,
      'group-1',
      { from: '2026-09-14', to: '2026-09-14' },
      ACADEMY,
    );
    expect(result.generatedCount).toBe(1);
    expect(result.classSessions[0]!.meetingUrl).toBeNull();
  });
});
