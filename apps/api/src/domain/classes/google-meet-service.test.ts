import { describe, expect, it, vi } from 'vitest';
import {
  assertMeetingStartNotInPast,
  createGoogleMeetService,
  GoogleMeetPastStartError,
  parseGoogleMeetCredentials,
} from './google-meet-service.js';

function futureIso(hoursFromNow = 2): string {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

function pastIso(hoursAgo = 2): string {
  return new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
}

describe('parseGoogleMeetCredentials', () => {
  it('returns null when any required field is missing', () => {
    expect(parseGoogleMeetCredentials({})).toBeNull();
    expect(
      parseGoogleMeetCredentials({
        GOOGLE_MEET_CLIENT_ID: 'id',
        GOOGLE_MEET_CLIENT_SECRET: 'secret',
      }),
    ).toBeNull();
  });

  it('defaults calendar id to primary', () => {
    const creds = parseGoogleMeetCredentials({
      GOOGLE_MEET_CLIENT_ID: 'id',
      GOOGLE_MEET_CLIENT_SECRET: 'secret',
      GOOGLE_MEET_REFRESH_TOKEN: 'refresh',
    });
    expect(creds?.calendarId).toBe('primary');
  });
});

describe('createGoogleMeetService', () => {
  it('creates a Meet link via Calendar API', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'event-1',
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
        }),
      });

    const service = createGoogleMeetService({
      credentials: {
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        calendarId: 'primary',
      },
      logger: { warn: vi.fn() } as unknown as import('pino').Logger,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(service.isConfigured()).toBe(true);

    const startAtIso = futureIso(2);
    const endAtIso = futureIso(3);
    const result = await service.createMeeting({
      summary: 'Clase',
      startAtIso,
      endAtIso,
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    expect(result.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(result.eventId).toBe('event-1');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const createBody = JSON.parse(
      (fetchImpl.mock.calls[1]![1] as { body: string }).body,
    ) as { description: string };
    expect(createBody.description).toBe('');
  });

  it('passes description on create', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'event-2',
          hangoutLink: 'https://meet.google.com/xyz',
        }),
      });

    const service = createGoogleMeetService({
      credentials: {
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        calendarId: 'primary',
      },
      logger: { warn: vi.fn() } as unknown as import('pino').Logger,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await service.createMeeting({
      summary: 'Clase',
      description: 'Material: https://example.com\nNotas',
      startAtIso: futureIso(2),
      endAtIso: futureIso(3),
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    const createBody = JSON.parse(
      (fetchImpl.mock.calls[1]![1] as { body: string }).body,
    ) as { description: string };
    expect(createBody.description).toBe('Material: https://example.com\nNotas');
  });

  it('rejects create when startAt is in the past', async () => {
    const fetchImpl = vi.fn();
    const service = createGoogleMeetService({
      credentials: {
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        calendarId: 'primary',
      },
      logger: { warn: vi.fn() } as unknown as import('pino').Logger,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      service.createMeeting({
        summary: 'Clase',
        startAtIso: pastIso(1),
        endAtIso: pastIso(0.5),
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    ).rejects.toBeInstanceOf(GoogleMeetPastStartError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('assertMeetingStartNotInPast allows future and equal now', () => {
    const now = new Date('2026-10-16T15:00:00.000Z');
    expect(() =>
      assertMeetingStartNotInPast('2026-10-16T15:00:00.000Z', now),
    ).not.toThrow();
    expect(() =>
      assertMeetingStartNotInPast('2026-10-16T14:59:59.000Z', now),
    ).toThrow(GoogleMeetPastStartError);
  });

  it('updates an existing Calendar event', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const service = createGoogleMeetService({
      credentials: {
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        calendarId: 'primary',
      },
      logger: { warn: vi.fn() } as unknown as import('pino').Logger,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await service.updateMeeting({
      eventId: 'event-1',
      description: 'Updated notes',
      startAtIso: '2026-10-21T15:00:00.000Z',
      endAtIso: '2026-10-21T16:00:00.000Z',
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    expect(fetchImpl.mock.calls[1]![0]).toContain('/events/event-1');
    expect(
      (fetchImpl.mock.calls[1]![1] as { method: string }).method,
    ).toBe('PATCH');
  });

  it('creates a Calendar link event without Hangouts Meet conference', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'evt_link_1' }),
      });

    const service = createGoogleMeetService({
      credentials: {
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        calendarId: 'primary',
      },
      logger: { warn: vi.fn() } as unknown as import('pino').Logger,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await service.createLinkEvent({
      summary: 'Clase Academia',
      description: 'Agenda',
      meetingUrl: 'https://zoom.us/j/123',
      startAtIso: '2030-06-01T15:00:00.000Z',
      endAtIso: '2030-06-01T16:00:00.000Z',
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    expect(result).toEqual({ eventId: 'evt_link_1' });
    const createBody = JSON.parse(
      (fetchImpl.mock.calls[1]![1] as { body: string }).body,
    ) as {
      conferenceData?: unknown;
      location?: string;
      description?: string;
    };
    expect(createBody.conferenceData).toBeUndefined();
    expect(createBody.location).toBe('https://zoom.us/j/123');
    expect(createBody.description).toContain('https://zoom.us/j/123');
  });

  it('deletes an existing Calendar event and treats 404 as success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' });

    const service = createGoogleMeetService({
      credentials: {
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        calendarId: 'primary',
      },
      logger: { warn: vi.fn() } as unknown as import('pino').Logger,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      service.deleteMeeting({ eventId: 'event-gone' }),
    ).resolves.toBeUndefined();
  });
});
