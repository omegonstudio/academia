import { vi } from 'vitest';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GoogleMeetService } from '../../domain/classes/google-meet-service.js';
import { GoogleMeetCreateError } from '../../domain/classes/google-meet-service.js';
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

describe('ClassSession Google Meet lifecycle', () => {
  let fixture: TestApp;
  let googleMeet: GoogleMeetService;

  beforeEach(async () => {
    googleMeet = createMeetMock();
    fixture = await buildTestApp({ googleMeet });
  });

  async function loginDirector(): Promise<string> {
    fixture.users.seed({
      id: 'director-meet-1',
      email: 'directora-meet@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    const response = await request(fixture.app)
      .post('/auth/login')
      .send({ email: 'directora-meet@academia.test', password: 'director-password-12' });
    return cookieFrom(response.headers['set-cookie'], SESSION_COOKIE)!;
  }

  async function createReadyGroup(cookie: string): Promise<string> {
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', cookie)
      .send({
        name: 'Meet Course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', cookie)
      .send({ courseId: course.body.course.id, name: 'Meet Group' });
    expect(group.status).toBe(201);

    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', cookie)
      .send({
        email: `teacher-meet-${Date.now()}@academia.test`,
        password: 'teacher-password-12',
        firstName: 'Meet',
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

  it('removeGoogleMeet clears Calendar event and local fields when eventId exists', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const startAt = futureStartAt(24);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt,
        meetingDescription: 'Keep this text',
        createGoogleMeet: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.classSession.googleCalendarEventId).toBe('cal-event-1');
    expect(created.body.classSession.meetingUrl).toBe(
      'https://meet.google.com/test-meet',
    );

    const removed = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ removeGoogleMeet: true });
    expect(removed.status).toBe(200);
    expect(removed.body.classSession.meetingUrl).toBeNull();
    expect(removed.body.classSession.googleCalendarEventId).toBeNull();
    expect(removed.body.classSession.meetingDescription).toBe('Keep this text');
    expect(googleMeet.deleteMeeting).toHaveBeenCalledWith({
      eventId: 'cal-event-1',
    });
  });

  it('removeGoogleMeet clears manual meetingUrl without calling Calendar', async () => {
    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: futureStartAt(30),
        meetingUrl: 'https://zoom.us/j/manual-only',
        meetingDescription: 'Manual notes',
      });
    expect(created.status).toBe(201);
    expect(created.body.classSession.googleCalendarEventId).toBeNull();

    const removed = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ removeGoogleMeet: true });
    expect(removed.status).toBe(200);
    expect(removed.body.classSession.meetingUrl).toBeNull();
    expect(removed.body.classSession.googleCalendarEventId).toBeNull();
    expect(removed.body.classSession.meetingDescription).toBe('Manual notes');
    expect(googleMeet.deleteMeeting).not.toHaveBeenCalled();
  });

  it('completes local remove when Google delete fails (best-effort)', async () => {
    googleMeet = createMeetMock({
      deleteMeeting: vi.fn(async () => {
        throw new Error('Calendar delete failed');
      }),
    });
    fixture = await buildTestApp({ googleMeet });

    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt: futureStartAt(36),
        createGoogleMeet: true,
      });
    expect(created.status).toBe(201);

    const removed = await request(fixture.app)
      .patch(`/classes/${created.body.classSession.id}`)
      .set('Cookie', cookie)
      .send({ removeGoogleMeet: true });
    expect(removed.status).toBe(200);
    expect(removed.body.classSession.meetingUrl).toBeNull();
    expect(removed.body.classSession.googleCalendarEventId).toBeNull();
  });

  it('keeps the class and flags meetCreationFailed when Google create fails after insert', async () => {
    googleMeet = createMeetMock({
      createMeeting: vi.fn(async () => {
        throw new GoogleMeetCreateError('Google Calendar rejected');
      }),
    });
    fixture = await buildTestApp({ googleMeet });

    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const startAt = futureStartAt(42);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({
        groupId,
        startAt,
        createGoogleMeet: true,
        meetingDescription: 'Retry later',
      });
    expect(created.status).toBe(201);
    expect(created.body.meetCreationFailed).toBe(true);
    expect(created.body.classSession.id).toBeTruthy();
    expect(created.body.classSession.meetingUrl).toBeNull();
    expect(created.body.classSession.googleCalendarEventId).toBeNull();
    expect(created.body.classSession.meetingDescription).toBe('Retry later');

    const listed = await request(fixture.app)
      .get('/classes')
      .set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(
      listed.body.classSessions.some(
        (row: { id: string }) => row.id === created.body.classSession.id,
      ),
    ).toBe(true);
  });

  it('recovers Meet via PATCH createGoogleMeet without duplicating the class', async () => {
    googleMeet = createMeetMock({
      createMeeting: vi
        .fn()
        .mockRejectedValueOnce(new GoogleMeetCreateError('transient'))
        .mockResolvedValueOnce({
          meetingUrl: 'https://meet.google.com/recovered',
          eventId: 'cal-recovered',
        }),
    });
    fixture = await buildTestApp({ googleMeet });

    const cookie = await loginDirector();
    const groupId = await createReadyGroup(cookie);
    const startAt = futureStartAt(50);

    const created = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt, createGoogleMeet: true });
    expect(created.status).toBe(201);
    expect(created.body.meetCreationFailed).toBe(true);
    const classId = created.body.classSession.id as string;

    const duplicate = await request(fixture.app)
      .post('/classes')
      .set('Cookie', cookie)
      .send({ groupId, startAt, createGoogleMeet: true });
    expect(duplicate.status).toBe(409);

    const recovered = await request(fixture.app)
      .patch(`/classes/${classId}`)
      .set('Cookie', cookie)
      .send({ createGoogleMeet: true });
    expect(recovered.status).toBe(200);
    expect(recovered.body.classSession.meetingUrl).toBe(
      'https://meet.google.com/recovered',
    );
    expect(recovered.body.classSession.googleCalendarEventId).toBe(
      'cal-recovered',
    );

    const listed = await request(fixture.app)
      .get('/classes')
      .set('Cookie', cookie);
    const sameSlot = listed.body.classSessions.filter(
      (row: { groupId: string; startAt: string; isActive: boolean }) =>
        row.groupId === groupId && row.startAt === startAt && row.isActive,
    );
    expect(sameSlot).toHaveLength(1);
  });
});
