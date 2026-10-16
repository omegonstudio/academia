import { vi } from 'vitest';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GoogleMeetService } from '../../domain/classes/google-meet-service.js';
import type { ZoomMeetingService } from '../../domain/classes/zoom-meeting-service.js';
import { ZoomMeetingApiError } from '../../domain/classes/zoom-meeting-service.js';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

function futureStartAt(hoursFromNow = 48): string {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

function createZoomMock(
  overrides: Partial<ZoomMeetingService> = {},
): ZoomMeetingService {
  return {
    isConfigured: () => true,
    hostUserId: () => 'host@academia.test',
    createMeeting: vi.fn(async () => ({
      meetingUrl: 'https://zoom.us/j/111111111',
      meetingId: '111111111',
    })),
    updateMeeting: vi.fn(async () => undefined),
    deleteMeeting: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createMeetMock(
  overrides: Partial<GoogleMeetService> = {},
): GoogleMeetService {
  return {
    isConfigured: () => true,
    calendarId: () => 'primary',
    createMeeting: vi.fn(async () => ({
      meetingUrl: 'https://meet.google.com/test-meet',
      eventId: 'cal-event-1',
    })),
    updateMeeting: vi.fn(async () => undefined),
    deleteMeeting: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('ClassSession Zoom lifecycle', () => {
  let fixture: TestApp;
  let zoomMeeting: ZoomMeetingService;
  let googleMeet: GoogleMeetService;

  beforeEach(async () => {
    zoomMeeting = createZoomMock();
    googleMeet = createMeetMock();
    fixture = await buildTestApp({ zoomMeeting, googleMeet });
  });

  async function loginDirector(): Promise<string> {
    fixture.users.seed({
      id: 'director-zoom-1',
      email: 'directora-zoom@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    const response = await request(fixture.app)
      .post('/auth/login')
      .send({
        email: 'directora-zoom@academia.test',
        password: 'director-password-12',
      });
    return cookieFrom(response.headers['set-cookie'], SESSION_COOKIE)!;
  }

  async function createReadyGroup(cookie: string): Promise<string> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Zoom Course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: course.body.course.id, name: 'Zoom Group' });
    expect(group.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: `teacher-zoom-${Date.now()}@academia.test`,
        password: 'teacher-password-12',
        firstName: 'Zoom',
        lastName: 'Teacher',
        level: 'C1',
      });
    expect(teacher.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/teacher`)
      .set('Cookie', cookie)
      .send({ teacherId: teacher.body.teacher.id });

    const schedule = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', cookie)
      .send({ day: 'MONDAY', startTime: '18:00', endTime: '20:00' });
    expect(schedule.status).toBe(201);

    await request(fixture.app)
      .patch(`/groups/${group.body.group.id}`)
      .set('Cookie', cookie)
      .send({ scheduleOptionId: schedule.body.scheduleOption.id });

    return group.body.group.id as string;
  }

  it('rejects createZoom when Zoom is not configured', async () => {
    fixture = await buildTestApp({
      zoomMeeting: createZoomMock({ isConfigured: () => false }),
      googleMeet,
    });
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt: futureStartAt(24), createZoom: true });
    expect(created.status).toBe(400);
    expect(created.body.error.message).toMatch(/Zoom is not configured/i);
  });

  it('reports Zoom status for authenticated users without secrets', async () => {
    const cookie = await loginDirector();
    const status = await request(fixture.app)
      .get('/zoom/status')
      .set('Cookie', cookie);
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ configured: true });
    expect(JSON.stringify(status.body)).not.toMatch(/secret|token|account/i);

    const unauth = await request(fixture.app).get('/zoom/status');
    expect(unauth.status).toBe(401);
  });

  it('reports Zoom not configured when service is absent', async () => {
    fixture = await buildTestApp({ googleMeet });
    const cookie = await loginDirector();
    const status = await request(fixture.app)
      .get('/zoom/status')
      .set('Cookie', cookie);
    expect(status.status).toBe(200);
    expect(status.body.configured).toBe(false);
  });

  it('creates a Zoom meeting on POST /classes', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: futureStartAt(24),
        meetingDescription: 'Agenda Zoom',
        createZoom: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.zoomCreationFailed).toBeUndefined();
    expect(created.body.classSession.meetingUrl).toBe(
      'https://zoom.us/j/111111111',
    );
    expect(created.body.classSession.zoomMeetingId).toBe('111111111');
    expect(created.body.classSession.meetingDescription).toBe('Agenda Zoom');
    expect(created.body.classSession.googleCalendarEventId).toBeNull();
    expect(zoomMeeting.createMeeting).toHaveBeenCalledOnce();
  });

  it('keeps the class and flags zoomCreationFailed when Zoom create fails', async () => {
    zoomMeeting = createZoomMock({
      createMeeting: vi.fn(async () => {
        throw new ZoomMeetingApiError('Zoom rejected');
      }),
    });
    fixture = await buildTestApp({ zoomMeeting, googleMeet });

    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const startAt = futureStartAt(30);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt,
        createZoom: true,
        meetingDescription: 'Retry later',
      });
    expect(created.status).toBe(201);
    expect(created.body.zoomCreationFailed).toBe(true);
    expect(created.body.classSession.meetingUrl).toBeNull();
    expect(created.body.classSession.zoomMeetingId).toBeNull();
    expect(created.body.classSession.meetingDescription).toBe('Retry later');
  });

  it('recovers Zoom via PATCH createZoom without duplicating the class', async () => {
    zoomMeeting = createZoomMock({
      createMeeting: vi
        .fn()
        .mockRejectedValueOnce(new ZoomMeetingApiError('transient'))
        .mockResolvedValueOnce({
          meetingUrl: 'https://zoom.us/j/recovered',
          meetingId: 'recovered-id',
        }),
    });
    fixture = await buildTestApp({ zoomMeeting, googleMeet });

    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const startAt = futureStartAt(36);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt, createZoom: true });
    expect(created.status).toBe(201);
    expect(created.body.zoomCreationFailed).toBe(true);
    const classId = created.body.classSession.id as string;

    const duplicate = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt, createZoom: true });
    expect(duplicate.status).toBe(409);

    const recovered = await request(fixture.app)
      .patch(`/classes/${classId}`)
      .set('Cookie', cookie)
      .send({ createZoom: true });
    expect(recovered.status).toBe(200);
    expect(recovered.body.classSession.meetingUrl).toBe(
      'https://zoom.us/j/recovered',
    );
    expect(recovered.body.classSession.zoomMeetingId).toBe('recovered-id');
  });

  it('syncs Zoom schedule and description on PATCH (best-effort)', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: futureStartAt(40),
        createZoom: true,
        meetingDescription: 'Initial',
      });
    expect(created.status).toBe(201);
    const classId = created.body.classSession.id as string;
    const newStart = futureStartAt(50);

    const updated = await request(fixture.app)
      .patch(`/classes/${classId}`)
      .set('Cookie', cookie)
      .send({
        startAt: newStart,
        meetingDescription: 'Updated agenda',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.classSession.startAt).toBe(newStart);
    expect(updated.body.classSession.meetingDescription).toBe(
      'Updated agenda',
    );
    expect(zoomMeeting.updateMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: '111111111',
        agenda: 'Updated agenda',
        startAtIso: newStart,
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
    );
  });

  it('keeps local update when Zoom sync fails (best-effort)', async () => {
    zoomMeeting = createZoomMock({
      updateMeeting: vi.fn(async () => {
        throw new ZoomMeetingApiError('update failed');
      }),
    });
    fixture = await buildTestApp({ zoomMeeting, googleMeet });

    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt: futureStartAt(42), createZoom: true });
    expect(created.status).toBe(201);

    const newStart = futureStartAt(55);
    const updated = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ startAt: newStart });
    expect(updated.status).toBe(200);
    expect(updated.body.classSession.startAt).toBe(newStart);
    expect(updated.body.classSession.zoomMeetingId).toBe('111111111');
  });

  it('removeZoom clears managed Zoom fields and calls delete', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: futureStartAt(44),
        meetingDescription: 'Keep notes',
        createZoom: true,
      });
    expect(created.status).toBe(201);

    const removed = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ removeZoom: true });
    expect(removed.status).toBe(200);
    expect(removed.body.classSession.meetingUrl).toBeNull();
    expect(removed.body.classSession.zoomMeetingId).toBeNull();
    expect(removed.body.classSession.meetingDescription).toBe('Keep notes');
    expect(zoomMeeting.deleteMeeting).toHaveBeenCalledWith({
      meetingId: '111111111',
    });
  });

  it('removeZoom does not clear a manual meeting URL without zoomMeetingId', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: futureStartAt(46),
        meetingUrl: 'https://zoom.us/j/manual-only',
        meetingDescription: 'Manual',
      });
    expect(created.status).toBe(201);
    expect(created.body.classSession.zoomMeetingId).toBeNull();

    const removed = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ removeZoom: true });
    expect(removed.status).toBe(200);
    expect(removed.body.classSession.meetingUrl).toBe(
      'https://zoom.us/j/manual-only',
    );
    expect(removed.body.classSession.zoomMeetingId).toBeNull();
    expect(zoomMeeting.deleteMeeting).not.toHaveBeenCalled();
  });

  it('soft-delete deletes managed Zoom and clears link fields', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt: futureStartAt(48), createZoom: true });
    expect(created.status).toBe(201);

    const deleted = await request(fixture.app)
      .delete(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie);
    expect(deleted.status).toBe(200);
    expect(deleted.body.classSession.isActive).toBe(false);
    expect(deleted.body.classSession.meetingUrl).toBeNull();
    expect(deleted.body.classSession.zoomMeetingId).toBeNull();
    expect(zoomMeeting.deleteMeeting).toHaveBeenCalledWith({
      meetingId: '111111111',
    });
  });

  it('rejects createZoom + createGoogleMeet on the same request', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: futureStartAt(50),
        createZoom: true,
        createGoogleMeet: true,
      });
    expect(created.status).toBe(400);
    expect(zoomMeeting.createMeeting).not.toHaveBeenCalled();
    expect(googleMeet.createMeeting).not.toHaveBeenCalled();
  });

  it('rejects createZoom when Google Meet is already managed', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt: futureStartAt(52), createGoogleMeet: true });
    expect(created.status).toBe(201);
    expect(created.body.classSession.googleCalendarEventId).toBe('cal-event-1');

    const zoomAttempt = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ createZoom: true });
    expect(zoomAttempt.status).toBe(400);
    expect(zoomAttempt.body.error.message).toMatch(/Remove the Google Meet/i);
    expect(zoomMeeting.createMeeting).not.toHaveBeenCalled();
  });

  it('rejects createGoogleMeet when Zoom is already managed', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt: futureStartAt(54), createZoom: true });
    expect(created.status).toBe(201);

    const meetAttempt = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ createGoogleMeet: true });
    expect(meetAttempt.status).toBe(400);
    expect(meetAttempt.body.error.message).toMatch(/Remove the Zoom meeting/i);
    expect(googleMeet.createMeeting).toHaveBeenCalledTimes(0);
  });

  it('preserves manual meeting URLs without treating them as managed Zoom', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: futureStartAt(56),
        meetingUrl: 'https://zoom.us/j/999888777',
      });
    expect(created.status).toBe(201);
    expect(created.body.classSession.zoomMeetingId).toBeNull();
    expect(zoomMeeting.createMeeting).not.toHaveBeenCalled();

    const rescheduled = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ startAt: futureStartAt(60) });
    expect(rescheduled.status).toBe(200);
    expect(rescheduled.body.classSession.meetingUrl).toBe(
      'https://zoom.us/j/999888777',
    );
    expect(zoomMeeting.updateMeeting).not.toHaveBeenCalled();
  });

  it('forbids unauthenticated class create with createZoom', async () => {
    const response = await request(fixture.app)
      .post('/classes')
      .send({
        groupId: '11111111-1111-4111-8111-111111111111',
        startAt: futureStartAt(10),
        createZoom: true,
      });
    expect(response.status).toBe(401);
  });
});
