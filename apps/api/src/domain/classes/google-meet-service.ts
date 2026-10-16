import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';

export interface GoogleMeetCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Calendar id that owns the Meet events. Defaults to `primary`. */
  calendarId: string;
}

export interface GoogleMeetCreateInput {
  summary: string;
  description?: string;
  startAtIso: string;
  endAtIso: string;
  /** IANA zone for the Calendar event (e.g. America/Argentina/Buenos_Aires). */
  timeZone: string;
}

export interface GoogleMeetCreateResult {
  meetingUrl: string;
  eventId: string;
}

export interface GoogleMeetService {
  isConfigured(): boolean;
  calendarId(): string | null;
  createMeeting(input: GoogleMeetCreateInput): Promise<GoogleMeetCreateResult>;
}

export class GoogleMeetNotConfiguredError extends Error {
  constructor() {
    super('Google Meet is not configured.');
    this.name = 'GoogleMeetNotConfiguredError';
  }
}

export class GoogleMeetCreateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleMeetCreateError';
  }
}

function trimOrEmpty(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function parseGoogleMeetCredentials(env: {
  GOOGLE_MEET_CLIENT_ID?: string;
  GOOGLE_MEET_CLIENT_SECRET?: string;
  GOOGLE_MEET_REFRESH_TOKEN?: string;
  GOOGLE_MEET_CALENDAR_ID?: string;
}): GoogleMeetCredentials | null {
  const clientId = trimOrEmpty(env.GOOGLE_MEET_CLIENT_ID);
  const clientSecret = trimOrEmpty(env.GOOGLE_MEET_CLIENT_SECRET);
  const refreshToken = trimOrEmpty(env.GOOGLE_MEET_REFRESH_TOKEN);
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }
  const calendarId = trimOrEmpty(env.GOOGLE_MEET_CALENDAR_ID) || 'primary';
  return { clientId, clientSecret, refreshToken, calendarId };
}

async function refreshAccessToken(
  credentials: GoogleMeetCredentials,
  fetchFn: typeof fetch,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: credentials.refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new GoogleMeetCreateError(
      'Could not refresh Google OAuth access token.',
    );
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new GoogleMeetCreateError('Google OAuth response missing access_token.');
  }
  return json.access_token;
}

/**
 * Creates a Calendar event with an attached Google Meet conference.
 * Requires a Workspace / personal Google account with Calendar API enabled and
 * a refresh token that includes `https://www.googleapis.com/auth/calendar`.
 */
export function createGoogleMeetService(options: {
  credentials: GoogleMeetCredentials | null;
  logger: Logger;
  fetchImpl?: typeof fetch;
}): GoogleMeetService {
  const { credentials, logger } = options;
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    isConfigured() {
      return credentials !== null;
    },

    calendarId() {
      return credentials?.calendarId ?? null;
    },

    async createMeeting(input) {
      if (!credentials) {
        throw new GoogleMeetNotConfiguredError();
      }

      const accessToken = await refreshAccessToken(credentials, fetchFn);
      const calendarId = encodeURIComponent(credentials.calendarId);
      const requestId = randomUUID();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1`;

      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description ?? '',
          start: {
            dateTime: input.startAtIso,
            timeZone: input.timeZone,
          },
          end: {
            dateTime: input.endAtIso,
            timeZone: input.timeZone,
          },
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        logger.warn(
          { status: response.status, detail: detail.slice(0, 300) },
          'Google Calendar Meet create failed',
        );
        throw new GoogleMeetCreateError(
          'Google Calendar rejected the Meet event create request.',
        );
      }

      const json = (await response.json()) as {
        id?: string;
        hangoutLink?: string;
        conferenceData?: {
          entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
        };
      };

      const fromEntry = json.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === 'video' && entry.uri,
      )?.uri;
      const meetingUrl = json.hangoutLink ?? fromEntry;
      if (!meetingUrl || !json.id) {
        throw new GoogleMeetCreateError(
          'Google Calendar event created without a Meet link.',
        );
      }

      return { meetingUrl, eventId: json.id };
    },
  };
}
