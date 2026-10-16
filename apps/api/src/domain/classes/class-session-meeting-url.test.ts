import { describe, expect, it } from 'vitest';
import {
  classSessionSchema,
  meetingUrlSchema,
  updateClassSessionRequestSchema,
} from '@academia/shared';
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

describe('classSessionSchema zoomMeetingId', () => {
  const baseSession = {
    id: '11111111-1111-4111-8111-111111111111',
    groupId: '22222222-2222-4222-8222-222222222222',
    startAt: '2026-10-20T21:00:00.000Z',
    endAt: '2026-10-20T23:00:00.000Z',
    serviceType: 'GROUP_120' as const,
    durationMinutes: 120 as const,
    scheduleOptionId: null,
    teacherId: null,
    meetingUrl: null,
    googleCalendarEventId: null,
    meetingDescription: null,
    isActive: true,
    createdAt: '2026-10-16T12:00:00.000Z',
    updatedAt: '2026-10-16T12:00:00.000Z',
  };

  it('accepts null zoomMeetingId and a Zoom-managed id', () => {
    expect(
      classSessionSchema.safeParse({ ...baseSession, zoomMeetingId: null })
        .success,
    ).toBe(true);
    expect(
      classSessionSchema.safeParse({
        ...baseSession,
        zoomMeetingId: '98765432101',
        meetingUrl: 'https://zoom.us/j/98765432101',
      }).success,
    ).toBe(true);
  });

  it('rejects oversized zoomMeetingId', () => {
    expect(
      classSessionSchema.safeParse({
        ...baseSession,
        zoomMeetingId: 'x'.repeat(256),
      }).success,
    ).toBe(false);
  });

  it('allows patching zoomMeetingId alone on update requests', () => {
    expect(
      updateClassSessionRequestSchema.safeParse({
        zoomMeetingId: '12345',
      }).success,
    ).toBe(true);
    expect(
      updateClassSessionRequestSchema.safeParse({
        zoomMeetingId: null,
      }).success,
    ).toBe(true);
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
    expect(without.zoomMeetingId).toBeNull();
    expect(without.googleCalendarEventId).toBeNull();

    const withUrl = await createClassSession(store, {
      groupId: 'group-1',
      startAt: '2026-09-21T21:00:00.000Z',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });
    expect(withUrl.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(withUrl.zoomMeetingId).toBeNull();
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
