import { describe, expect, it, vi } from 'vitest';
import {
  assertZoomMeetingStartNotInPast,
  createZoomMeetingService,
  parseZoomMeetingCredentials,
  ZoomMeetingAuthError,
  ZoomMeetingApiError,
  ZoomMeetingNetworkError,
  ZoomMeetingNotConfiguredError,
  ZoomMeetingNotFoundError,
  ZoomMeetingPastStartError,
} from './zoom-meeting-service.js';

const FULL_ENV = {
  ZOOM_ACCOUNT_ID: 'account-1',
  ZOOM_CLIENT_ID: 'client-1',
  ZOOM_CLIENT_SECRET: 'super-secret-value',
  ZOOM_HOST_USER_ID: 'host@academia.test',
} as const;

const CREDENTIALS = {
  accountId: 'account-1',
  clientId: 'client-1',
  clientSecret: 'super-secret-value',
  hostUserId: 'host@academia.test',
} as const;

function futureIso(hoursFromNow = 2): string {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

function pastIso(hoursAgo = 2): string {
  return new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
}

function mockLogger() {
  return { warn: vi.fn() } as unknown as import('pino').Logger;
}

function createService(fetchImpl: typeof fetch) {
  return createZoomMeetingService({
    credentials: { ...CREDENTIALS },
    logger: mockLogger(),
    fetchImpl,
  });
}

describe('parseZoomMeetingCredentials', () => {
  it('returns null when credentials are missing', () => {
    expect(parseZoomMeetingCredentials({})).toBeNull();
  });

  it('returns null when credentials are incomplete', () => {
    expect(
      parseZoomMeetingCredentials({
        ZOOM_ACCOUNT_ID: 'account-1',
        ZOOM_CLIENT_ID: 'client-1',
        ZOOM_CLIENT_SECRET: 'secret',
      }),
    ).toBeNull();
    expect(
      parseZoomMeetingCredentials({
        ZOOM_ACCOUNT_ID: 'account-1',
        ZOOM_CLIENT_ID: 'client-1',
        ZOOM_HOST_USER_ID: 'host@academia.test',
      }),
    ).toBeNull();
  });

  it('returns credentials when all required fields are present', () => {
    expect(parseZoomMeetingCredentials(FULL_ENV)).toEqual(CREDENTIALS);
  });
});

describe('createZoomMeetingService', () => {
  it('reports not configured without credentials', () => {
    const service = createZoomMeetingService({
      credentials: null,
      logger: mockLogger(),
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(service.isConfigured()).toBe(false);
    expect(service.hostUserId()).toBeNull();
  });

  it('does not call Zoom when credentials are incomplete (null)', async () => {
    const fetchImpl = vi.fn();
    const service = createZoomMeetingService({
      credentials: parseZoomMeetingCredentials({
        ZOOM_ACCOUNT_ID: 'account-1',
        ZOOM_CLIENT_ID: 'client-1',
      }),
      logger: mockLogger(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(service.isConfigured()).toBe(false);
    await expect(
      service.createMeeting({
        topic: 'Clase',
        startAtIso: futureIso(2),
        endAtIso: futureIso(3),
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    ).rejects.toBeInstanceOf(ZoomMeetingNotConfiguredError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports configured when credentials are complete', () => {
    const service = createService(vi.fn() as unknown as typeof fetch);
    expect(service.isConfigured()).toBe(true);
    expect(service.hostUserId()).toBe('host@academia.test');
  });

  it('requests an OAuth token with account_credentials and Basic auth', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 98_765_432_101,
          join_url: 'https://zoom.us/j/98765432101',
        }),
      });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await service.createMeeting({
      topic: 'Clase Academia',
      startAtIso: futureIso(2),
      endAtIso: futureIso(3),
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    expect(fetchImpl.mock.calls[0]![0]).toBe('https://zoom.us/oauth/token');
    const tokenInit = fetchImpl.mock.calls[0]![1] as {
      method: string;
      headers: Record<string, string>;
      body: URLSearchParams;
    };
    expect(tokenInit.method).toBe('POST');
    expect(tokenInit.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(tokenInit.headers.Authorization).toMatch(/^Basic /);
    expect(tokenInit.headers.Authorization).not.toContain('super-secret-value');
    expect(tokenInit.body.get('grant_type')).toBe('account_credentials');
    expect(tokenInit.body.get('account_id')).toBe('account-1');
  });

  it('creates a meeting and returns meetingId + join_url', async () => {
    const startAtIso = futureIso(2);
    const endAtIso = futureIso(3);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 11_111,
          join_url: 'https://zoom.us/j/11111',
        }),
      });

    const service = createService(fetchImpl as unknown as typeof fetch);
    const result = await service.createMeeting({
      topic: 'Clase',
      agenda: 'Materiales del módulo',
      startAtIso,
      endAtIso,
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    expect(result).toEqual({
      meetingId: '11111',
      meetingUrl: 'https://zoom.us/j/11111',
    });

    const createUrl = fetchImpl.mock.calls[1]![0] as string;
    expect(createUrl).toBe(
      'https://api.zoom.us/v2/users/host%40academia.test/meetings',
    );
    const createBody = JSON.parse(
      (fetchImpl.mock.calls[1]![1] as { body: string }).body,
    ) as {
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      agenda: string;
    };
    expect(createBody.topic).toBe('Clase');
    expect(createBody.type).toBe(2);
    expect(createBody.start_time).toBe(startAtIso);
    expect(createBody.duration).toBe(60);
    expect(createBody.timezone).toBe('America/Argentina/Buenos_Aires');
    expect(createBody.agenda).toBe('Materiales del módulo');
  });

  it('rejects create when startAt is in the past without calling Zoom', async () => {
    const fetchImpl = vi.fn();
    const service = createService(fetchImpl as unknown as typeof fetch);

    await expect(
      service.createMeeting({
        topic: 'Clase',
        startAtIso: pastIso(1),
        endAtIso: pastIso(0.5),
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    ).rejects.toBeInstanceOf(ZoomMeetingPastStartError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('assertZoomMeetingStartNotInPast allows future and equal now', () => {
    const now = new Date('2026-10-16T15:00:00.000Z');
    expect(() =>
      assertZoomMeetingStartNotInPast('2026-10-16T15:00:00.000Z', now),
    ).not.toThrow();
    expect(() =>
      assertZoomMeetingStartNotInPast('2026-10-16T14:59:59.000Z', now),
    ).toThrow(ZoomMeetingPastStartError);
  });

  it('updates meeting schedule', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await service.updateMeeting({
      meetingId: '222',
      startAtIso: '2026-10-21T18:00:00.000Z',
      endAtIso: '2026-10-21T20:00:00.000Z',
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    expect(fetchImpl.mock.calls[1]![0]).toBe(
      'https://api.zoom.us/v2/meetings/222',
    );
    expect((fetchImpl.mock.calls[1]![1] as { method: string }).method).toBe(
      'PATCH',
    );
    const body = JSON.parse(
      (fetchImpl.mock.calls[1]![1] as { body: string }).body,
    ) as { start_time: string; duration: number; timezone: string };
    expect(body.start_time).toBe('2026-10-21T18:00:00.000Z');
    expect(body.duration).toBe(120);
    expect(body.timezone).toBe('America/Argentina/Buenos_Aires');
  });

  it('updates meeting agenda/description', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await service.updateMeeting({
      meetingId: '222',
      agenda: 'Nueva agenda',
    });

    const body = JSON.parse(
      (fetchImpl.mock.calls[1]![1] as { body: string }).body,
    ) as { agenda: string };
    expect(body.agenda).toBe('Nueva agenda');
  });

  it('deletes a meeting', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await expect(
      service.deleteMeeting({ meetingId: '333' }),
    ).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[1]![0]).toBe(
      'https://api.zoom.us/v2/meetings/333',
    );
    expect((fetchImpl.mock.calls[1]![1] as { method: string }).method).toBe(
      'DELETE',
    );
  });

  it('treats delete 404 as success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'not found',
      });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await expect(
      service.deleteMeeting({ meetingId: 'gone' }),
    ).resolves.toBeUndefined();
  });

  it('throws auth error when token request is unauthorized', async () => {
    const logger = mockLogger();
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    });

    const service = createZoomMeetingService({
      credentials: { ...CREDENTIALS },
      logger,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      service.createMeeting({
        topic: 'Clase',
        startAtIso: futureIso(2),
        endAtIso: futureIso(3),
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    ).rejects.toBeInstanceOf(ZoomMeetingAuthError);

    const warnPayload = vi.mocked(logger.warn).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    const warnText = JSON.stringify(warnPayload);
    expect(warnText).not.toContain('super-secret-value');
    expect(warnText).not.toContain('token-');
  });

  it('throws API error when create fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'bad request',
      });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await expect(
      service.createMeeting({
        topic: 'Clase',
        startAtIso: futureIso(2),
        endAtIso: futureIso(3),
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    ).rejects.toBeInstanceOf(ZoomMeetingApiError);
  });

  it('throws API error when update fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'server error',
      });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await expect(
      service.updateMeeting({ meetingId: '1', agenda: 'x' }),
    ).rejects.toBeInstanceOf(ZoomMeetingApiError);
  });

  it('throws not found when update targets a missing meeting', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'missing',
      });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await expect(
      service.updateMeeting({ meetingId: 'missing', agenda: 'x' }),
    ).rejects.toBeInstanceOf(ZoomMeetingNotFoundError);
  });

  it('throws auth error when delete is forbidden', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'forbidden',
      });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await expect(
      service.deleteMeeting({ meetingId: '1' }),
    ).rejects.toBeInstanceOf(ZoomMeetingAuthError);
  });

  it('throws network error when fetch fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET'));
    const service = createService(fetchImpl as unknown as typeof fetch);

    await expect(
      service.createMeeting({
        topic: 'Clase',
        startAtIso: futureIso(2),
        endAtIso: futureIso(3),
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    ).rejects.toBeInstanceOf(ZoomMeetingNetworkError);
  });

  it('reuses a cached access token across meeting calls', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-cached', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          join_url: 'https://zoom.us/j/1',
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' });

    const service = createService(fetchImpl as unknown as typeof fetch);
    await service.createMeeting({
      topic: 'Clase',
      startAtIso: futureIso(2),
      endAtIso: futureIso(3),
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    await service.deleteMeeting({ meetingId: '1' });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://zoom.us/oauth/token');
    expect(fetchImpl.mock.calls[1]![0]).toContain('/users/');
    expect(fetchImpl.mock.calls[2]![0]).toContain('/meetings/');
  });

  it('deduplicates concurrent token requests', async () => {
    let resolveToken: ((value: unknown) => void) | undefined;
    const tokenPromise = new Promise((resolve) => {
      resolveToken = resolve;
    });

    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => tokenPromise)
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 9,
          join_url: 'https://zoom.us/j/9',
        }),
      });

    const service = createService(fetchImpl as unknown as typeof fetch);
    const createA = service.createMeeting({
      topic: 'A',
      startAtIso: futureIso(2),
      endAtIso: futureIso(3),
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    const createB = service.createMeeting({
      topic: 'B',
      startAtIso: futureIso(4),
      endAtIso: futureIso(5),
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    resolveToken?.({
      ok: true,
      json: async () => ({ access_token: 'shared-token', expires_in: 3600 }),
    });

    await Promise.all([createA, createB]);
    const tokenCalls = fetchImpl.mock.calls.filter(
      (call) => call[0] === 'https://zoom.us/oauth/token',
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it('does not log client secrets or access tokens', async () => {
    const logger = mockLogger();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'very-secret-access-token',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid',
      });

    const service = createZoomMeetingService({
      credentials: { ...CREDENTIALS },
      logger,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      service.createMeeting({
        topic: 'Clase',
        startAtIso: futureIso(2),
        endAtIso: futureIso(3),
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    ).rejects.toBeInstanceOf(ZoomMeetingApiError);

    const serialized = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(serialized).not.toContain('super-secret-value');
    expect(serialized).not.toContain('very-secret-access-token');
    expect(serialized).not.toContain('Authorization');
  });
});
