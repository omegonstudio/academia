import { describe, expect, it, vi } from 'vitest';
import {
  createGoogleMeetService,
  parseGoogleMeetCredentials,
} from './google-meet-service.js';

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

    const result = await service.createMeeting({
      summary: 'Clase',
      startAtIso: '2026-10-20T15:00:00.000Z',
      endAtIso: '2026-10-20T16:00:00.000Z',
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    expect(result.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(result.eventId).toBe('event-1');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
