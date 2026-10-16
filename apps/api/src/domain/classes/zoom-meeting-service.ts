import type { Logger } from 'pino';

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';
/** Refresh the access token this many ms before Zoom's expires_in. */
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export interface ZoomMeetingCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
  /** Zoom user id or email of the academy host that owns meetings. */
  hostUserId: string;
}

export interface ZoomMeetingCreateInput {
  topic: string;
  agenda?: string;
  startAtIso: string;
  endAtIso: string;
  /** IANA zone (e.g. America/Argentina/Buenos_Aires). */
  timeZone: string;
}

export interface ZoomMeetingCreateResult {
  meetingUrl: string;
  meetingId: string;
}

export interface ZoomMeetingUpdateInput {
  meetingId: string;
  topic?: string;
  agenda?: string;
  startAtIso?: string;
  endAtIso?: string;
  timeZone?: string;
}

export interface ZoomMeetingService {
  isConfigured(): boolean;
  hostUserId(): string | null;
  createMeeting(input: ZoomMeetingCreateInput): Promise<ZoomMeetingCreateResult>;
  updateMeeting(input: ZoomMeetingUpdateInput): Promise<void>;
  deleteMeeting(input: { meetingId: string }): Promise<void>;
}

export class ZoomMeetingNotConfiguredError extends Error {
  constructor() {
    super('Zoom is not configured.');
    this.name = 'ZoomMeetingNotConfiguredError';
  }
}

export class ZoomMeetingApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZoomMeetingApiError';
  }
}

export class ZoomMeetingAuthError extends ZoomMeetingApiError {
  constructor(message = 'Zoom authentication failed.') {
    super(message);
    this.name = 'ZoomMeetingAuthError';
  }
}

export class ZoomMeetingNetworkError extends ZoomMeetingApiError {
  constructor(message = 'Could not reach Zoom.') {
    super(message);
    this.name = 'ZoomMeetingNetworkError';
  }
}

export class ZoomMeetingNotFoundError extends ZoomMeetingApiError {
  constructor() {
    super('Zoom meeting not found.');
    this.name = 'ZoomMeetingNotFoundError';
  }
}

export class ZoomMeetingInvalidInputError extends ZoomMeetingApiError {
  constructor(message: string) {
    super(message);
    this.name = 'ZoomMeetingInvalidInputError';
  }
}

export class ZoomMeetingPastStartError extends ZoomMeetingApiError {
  constructor() {
    super('Cannot create a Zoom meeting for a class that starts in the past.');
    this.name = 'ZoomMeetingPastStartError';
  }
}

/** Rejects create when the class start instant is strictly before `now`. */
export function assertZoomMeetingStartNotInPast(
  startAtIso: string,
  now: Date = new Date(),
): void {
  const startAt = new Date(startAtIso);
  if (Number.isNaN(startAt.getTime())) {
    throw new ZoomMeetingInvalidInputError('Invalid meeting start time.');
  }
  if (startAt.getTime() < now.getTime()) {
    throw new ZoomMeetingPastStartError();
  }
}

function trimOrEmpty(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function parseZoomMeetingCredentials(env: {
  ZOOM_ACCOUNT_ID?: string;
  ZOOM_CLIENT_ID?: string;
  ZOOM_CLIENT_SECRET?: string;
  ZOOM_HOST_USER_ID?: string;
}): ZoomMeetingCredentials | null {
  const accountId = trimOrEmpty(env.ZOOM_ACCOUNT_ID);
  const clientId = trimOrEmpty(env.ZOOM_CLIENT_ID);
  const clientSecret = trimOrEmpty(env.ZOOM_CLIENT_SECRET);
  const hostUserId = trimOrEmpty(env.ZOOM_HOST_USER_ID);
  if (!accountId || !clientId || !clientSecret || !hostUserId) {
    return null;
  }
  return { accountId, clientId, clientSecret, hostUserId };
}

function durationMinutesFromRange(startAtIso: string, endAtIso: string): number {
  const startAt = new Date(startAtIso);
  const endAt = new Date(endAtIso);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new ZoomMeetingInvalidInputError('Invalid meeting start or end time.');
  }
  const minutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
  if (minutes < 1) {
    throw new ZoomMeetingInvalidInputError(
      'Meeting duration must be at least one minute.',
    );
  }
  return minutes;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString(
    'base64',
  );
  return `Basic ${encoded}`;
}

async function readErrorDetail(response: Response): Promise<string> {
  const detail = await response.text().catch(() => '');
  return detail.slice(0, 300);
}

/**
 * Creates / updates / deletes Zoom meetings for a single academy host user
 * via Server-to-Server OAuth (account_credentials). Requires a Zoom S2S app
 * with meeting create/update/delete scopes and a licensed host when the plan
 * requires it.
 */
export function createZoomMeetingService(options: {
  credentials: ZoomMeetingCredentials | null;
  logger: Logger;
  fetchImpl?: typeof fetch;
}): ZoomMeetingService {
  const { credentials, logger } = options;
  const fetchFn = options.fetchImpl ?? fetch;

  let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;
  let tokenInflight: Promise<string> | null = null;

  function clearTokenCache(): void {
    cachedToken = null;
  }

  async function fetchAccessToken(): Promise<string> {
    if (!credentials) {
      throw new ZoomMeetingNotConfiguredError();
    }

    const body = new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: credentials.accountId,
    });

    let response: Response;
    try {
      response = await fetchFn(ZOOM_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(
            credentials.clientId,
            credentials.clientSecret,
          ),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
    } catch {
      throw new ZoomMeetingNetworkError(
        'Could not reach Zoom OAuth token endpoint.',
      );
    }

    if (response.status === 401 || response.status === 403) {
      clearTokenCache();
      logger.warn(
        { status: response.status },
        'Zoom OAuth token request unauthorized',
      );
      throw new ZoomMeetingAuthError();
    }

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      logger.warn(
        { status: response.status, detail },
        'Zoom OAuth token request failed',
      );
      throw new ZoomMeetingApiError('Could not obtain a Zoom access token.');
    }

    const json = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new ZoomMeetingApiError('Zoom OAuth response missing access_token.');
    }

    const expiresInSec =
      typeof json.expires_in === 'number' && json.expires_in > 0
        ? json.expires_in
        : 3600;
    cachedToken = {
      accessToken: json.access_token,
      expiresAtMs: Date.now() + expiresInSec * 1000,
    };
    return json.access_token;
  }

  async function getAccessToken(): Promise<string> {
    if (!credentials) {
      throw new ZoomMeetingNotConfiguredError();
    }

    const now = Date.now();
    if (
      cachedToken &&
      cachedToken.expiresAtMs - TOKEN_EXPIRY_SKEW_MS > now
    ) {
      return cachedToken.accessToken;
    }

    if (tokenInflight) {
      return tokenInflight;
    }

    tokenInflight = fetchAccessToken().finally(() => {
      tokenInflight = null;
    });
    return tokenInflight;
  }

  async function zoomFetch(
    path: string,
    init: {
      method: string;
      body?: string;
    },
  ): Promise<Response> {
    const accessToken = await getAccessToken();
    try {
      return await fetchFn(`${ZOOM_API_BASE}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(init.body
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        body: init.body,
      });
    } catch {
      throw new ZoomMeetingNetworkError('Could not reach Zoom Meetings API.');
    }
  }

  function throwForMeetingResponse(
    response: Response,
    action: 'create' | 'update' | 'delete',
    detail: string,
  ): never {
    if (response.status === 401 || response.status === 403) {
      clearTokenCache();
      logger.warn(
        { status: response.status, action },
        'Zoom Meetings API unauthorized',
      );
      throw new ZoomMeetingAuthError();
    }
    if (response.status === 404) {
      throw new ZoomMeetingNotFoundError();
    }
    logger.warn(
      { status: response.status, action, detail },
      'Zoom Meetings API request failed',
    );
    throw new ZoomMeetingApiError(
      `Zoom rejected the meeting ${action} request.`,
    );
  }

  return {
    isConfigured() {
      return credentials !== null;
    },

    hostUserId() {
      return credentials?.hostUserId ?? null;
    },

    async createMeeting(input) {
      if (!credentials) {
        throw new ZoomMeetingNotConfiguredError();
      }

      assertZoomMeetingStartNotInPast(input.startAtIso);
      const duration = durationMinutesFromRange(
        input.startAtIso,
        input.endAtIso,
      );

      const response = await zoomFetch(
        `/users/${encodeURIComponent(credentials.hostUserId)}/meetings`,
        {
          method: 'POST',
          body: JSON.stringify({
            topic: input.topic,
            type: 2,
            start_time: input.startAtIso,
            duration,
            timezone: input.timeZone,
            agenda: input.agenda ?? '',
          }),
        },
      );

      if (!response.ok) {
        throwForMeetingResponse(
          response,
          'create',
          await readErrorDetail(response),
        );
      }

      const json = (await response.json()) as {
        id?: number | string;
        join_url?: string;
      };
      if (json.id === undefined || json.id === null || !json.join_url) {
        throw new ZoomMeetingApiError(
          'Zoom meeting created without id or join_url.',
        );
      }

      return {
        meetingId: String(json.id),
        meetingUrl: json.join_url,
      };
    },

    async updateMeeting(input) {
      if (!credentials) {
        throw new ZoomMeetingNotConfiguredError();
      }

      const body: Record<string, unknown> = {};
      if (input.topic !== undefined) body.topic = input.topic;
      if (input.agenda !== undefined) body.agenda = input.agenda;
      if (input.startAtIso !== undefined) {
        body.start_time = input.startAtIso;
      }
      if (
        input.startAtIso !== undefined &&
        input.endAtIso !== undefined
      ) {
        body.duration = durationMinutesFromRange(
          input.startAtIso,
          input.endAtIso,
        );
      }
      if (input.timeZone !== undefined) body.timezone = input.timeZone;

      if (Object.keys(body).length === 0) {
        return;
      }

      const response = await zoomFetch(
        `/meetings/${encodeURIComponent(input.meetingId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        throwForMeetingResponse(
          response,
          'update',
          await readErrorDetail(response),
        );
      }
    },

    async deleteMeeting(input) {
      if (!credentials) {
        throw new ZoomMeetingNotConfiguredError();
      }

      const response = await zoomFetch(
        `/meetings/${encodeURIComponent(input.meetingId)}`,
        { method: 'DELETE' },
      );

      if (response.ok || response.status === 204) {
        return;
      }

      // Already gone — treat as success (same lifecycle expectation as Meet).
      if (response.status === 404) {
        return;
      }

      throwForMeetingResponse(
        response,
        'delete',
        await readErrorDetail(response),
      );
    },
  };
}
