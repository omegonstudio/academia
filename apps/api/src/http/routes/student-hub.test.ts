import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Student Hub self-scoped routes', () => {
  let fixture: TestApp;

  beforeEach(async () => {
    fixture = await buildTestApp();
  });

  async function loginAs(
    email: string,
    password: string,
  ): Promise<string | undefined> {
    const response = await request(fixture.app)
      .post('/auth/login')
      .send({ email, password });
    return cookieFrom(response.headers['set-cookie'], SESSION_COOKIE);
  }

  async function seedDirector(): Promise<string> {
    fixture.users.seed({
      id: 'director-hub-1',
      email: 'director-hub@academia.test',
      name: 'DIRECTOR',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    return (await loginAs(
      'director-hub@academia.test',
      'director-password-12',
    ))!;
  }

  it('rejects anonymous callers with 401', async () => {
    expect((await request(fixture.app).get('/students/me')).status).toBe(401);
    expect(
      (await request(fixture.app).get('/students/me/materials')).status,
    ).toBe(401);
    expect(
      (
        await request(fixture.app)
          .get('/students/me/attendance')
          .query({ from: '2026-09-01', to: '2026-09-30' })
      ).status,
    ).toBe(401);
  });

  it('GET /students/me returns only the authenticated student profile', async () => {
    const director = await seedDirector();
    const a = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'hub-a@academia.test',
        password: 'student-password-12',
        firstName: 'Ana',
        lastName: 'Alpha',
        level: 'A1',
      });
    expect(a.status).toBe(201);
    const b = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'hub-b@academia.test',
        password: 'student-password-12',
        firstName: 'Beto',
        lastName: 'Beta',
        level: 'B1',
      });
    expect(b.status).toBe(201);

    const cookieA = await loginAs('hub-a@academia.test', 'student-password-12');
    const me = await request(fixture.app)
      .get('/students/me')
      .set('Cookie', cookieA!);
    expect(me.status).toBe(200);
    expect(me.body.student.id).toBe(a.body.student.id);
    expect(me.body.student.id).not.toBe(b.body.student.id);

    const asDirector = await request(fixture.app)
      .get('/students/me')
      .set('Cookie', director);
    expect(asDirector.status).toBe(403);
  });

  it('materials list is entitlement-scoped per student', async () => {
    const director = await seedDirector();
    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', director)
      .send({
        name: 'Hub materials course',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
      });
    expect(course.status).toBe(201);
    const otherCourse = await request(fixture.app)
      .post('/courses')
      .set('Cookie', director)
      .send({
        name: 'Other course',
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
      });
    expect(otherCourse.status).toBe(201);
    fixture.materials.seedCourse(course.body.course.id);
    fixture.materials.seedCourse(otherCourse.body.course.id);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', director)
      .send({
        courseId: course.body.course.id,
        name: 'Hub materials group',
      });
    expect(group.status).toBe(201);
    const otherGroup = await request(fixture.app)
      .post('/groups')
      .set('Cookie', director)
      .send({
        courseId: otherCourse.body.course.id,
        name: 'Other group',
      });
    expect(otherGroup.status).toBe(201);

    const student = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'hub-mat-a@academia.test',
        password: 'student-password-12',
        firstName: 'Mat',
        lastName: 'A',
        level: 'A1',
      });
    expect(student.status).toBe(201);
    const outsider = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'hub-mat-b@academia.test',
        password: 'student-password-12',
        firstName: 'Mat',
        lastName: 'B',
        level: 'A2',
      });
    expect(outsider.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/students`)
      .set('Cookie', director)
      .send({ studentId: student.body.student.id });
    await request(fixture.app)
      .post(`/groups/${otherGroup.body.group.id}/students`)
      .set('Cookie', director)
      .send({ studentId: outsider.body.student.id });

    const material = await request(fixture.app)
      .post('/materials')
      .set('Cookie', director)
      .send({
        title: 'Guía propia',
        kind: 'LINK',
        externalUrl: 'https://example.com/guia',
        courseId: course.body.course.id,
      });
    expect(material.status).toBe(201);

    fixture.materials.deps.studentCourses.set(
      student.body.student.id,
      new Set([course.body.course.id]),
    );
    fixture.materials.deps.studentCourses.set(
      outsider.body.student.id,
      new Set([otherCourse.body.course.id]),
    );

    const cookieA = await loginAs(
      'hub-mat-a@academia.test',
      'student-password-12',
    );
    const cookieB = await loginAs(
      'hub-mat-b@academia.test',
      'student-password-12',
    );

    const listA = await request(fixture.app)
      .get('/students/me/materials')
      .set('Cookie', cookieA!);
    expect(listA.status).toBe(200);
    expect(listA.body.materials).toHaveLength(1);
    expect(listA.body.materials[0].id).toBe(material.body.material.id);

    const listB = await request(fixture.app)
      .get('/students/me/materials')
      .set('Cookie', cookieB!);
    expect(listB.status).toBe(200);
    expect(listB.body.materials).toHaveLength(0);
  });

  it('attendance history is self-scoped; student cannot write attendance', async () => {
    const director = await seedDirector();
    const teacher = await request(fixture.app)
      .post('/teachers')
      .set('Cookie', director)
      .send({
        email: 'hub-teacher@academia.test',
        password: 'teacher-password-12',
        firstName: 'Tea',
        lastName: 'Cher',
        level: 'C1',
      });
    expect(teacher.status).toBe(201);

    const course = await request(fixture.app)
      .post('/courses')
      .set('Cookie', director)
      .send({
        name: 'Hub attendance course',
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
      });
    expect(course.status).toBe(201);

    const group = await request(fixture.app)
      .post('/groups')
      .set('Cookie', director)
      .send({
        courseId: course.body.course.id,
        name: 'Hub attendance group',
      });
    expect(group.status).toBe(201);
    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/teacher`)
      .set('Cookie', director)
      .send({ teacherId: teacher.body.teacher.id });

    const option = await request(fixture.app)
      .post('/schedule-options')
      .set('Cookie', director)
      .send({ day: 'SATURDAY', startTime: '12:00', endTime: '13:00' });
    expect(option.status).toBe(201);
    await request(fixture.app)
      .patch(`/groups/${group.body.group.id}`)
      .set('Cookie', director)
      .send({ scheduleOptionId: option.body.scheduleOption.id });

    const student = await request(fixture.app)
      .post('/students')
      .set('Cookie', director)
      .send({
        email: 'hub-att@academia.test',
        password: 'student-password-12',
        firstName: 'Att',
        lastName: 'End',
        level: 'B1',
      });
    expect(student.status).toBe(201);

    await request(fixture.app)
      .post(`/groups/${group.body.group.id}/students`)
      .set('Cookie', director)
      .send({ studentId: student.body.student.id });

    const session = await request(fixture.app)
      .post('/classes')
      .set('Cookie', director)
      .send({
        groupId: group.body.group.id,
        startAt: '2026-09-20T15:00:00.000Z',
      });
    expect(session.status).toBe(201);

    const teacherCookie = await loginAs(
      'hub-teacher@academia.test',
      'teacher-password-12',
    );
    const mark = await request(fixture.app)
      .post(`/classes/${session.body.classSession.id}/attendance`)
      .set('Cookie', teacherCookie!)
      .send({
        studentId: student.body.student.id,
        status: 'PRESENT',
      });
    expect(mark.status).toBe(201);

    const studentCookie = await loginAs(
      'hub-att@academia.test',
      'student-password-12',
    );
    const history = await request(fixture.app)
      .get('/students/me/attendance')
      .query({ from: '2026-09-01', to: '2026-09-30' })
      .set('Cookie', studentCookie!);
    expect(history.status).toBe(200);
    expect(history.body.attendances).toHaveLength(1);
    expect(history.body.attendances[0].studentId).toBe(student.body.student.id);
    expect(history.body.attendances[0].status).toBe('PRESENT');
    expect(history.body.attendances[0].classSession.group.course.name).toBe(
      'Hub attendance course',
    );

    const write = await request(fixture.app)
      .post(`/classes/${session.body.classSession.id}/attendance`)
      .set('Cookie', studentCookie!)
      .send({
        studentId: student.body.student.id,
        status: 'ABSENT',
      });
    expect(write.status).toBe(403);
  });

  it('GET /students/me/finance is self-scoped and omits internal split fields', async () => {
    const director = await seedDirector();

    const studentA = await fixture.studentRegistry.createWithNewUser({
      email: 'fin-a@academia.test',
      passwordHash: await hashPassword('student-password-12'),
      firstName: 'Fin',
      lastName: 'A',
      level: 'A1',
      isActive: true,
    });
    const studentB = await fixture.studentRegistry.createWithNewUser({
      email: 'fin-b@academia.test',
      passwordHash: await hashPassword('student-password-12'),
      firstName: 'Fin',
      lastName: 'B',
      level: 'A2',
      isActive: true,
    });
    const teacher = await fixture.teacherRegistry.createWithNewUser({
      email: 'fin-teacher@academia.test',
      passwordHash: await hashPassword('teacher-password-12'),
      firstName: 'Tea',
      lastName: 'Cher',
      level: 'C1',
      availability: 'AVAILABLE',
      isActive: true,
    });

    async function seedPaidCharge(studentId: string, amount: bigint) {
      const classSessionId = randomUUID();
      const groupId = randomUUID();
      const courseId = randomUUID();
      fixture.finance.seedClassSession({
        classSessionId,
        groupId,
        courseId,
        serviceType: 'ONE_TO_ONE_60',
        teacherId: teacher.id,
        courseAmountMinor: amount,
        courseCurrency: 'ARS',
        studentEnrolled: true,
        studentId,
      });
      const chargeRes = await request(fixture.app)
        .post('/finance/charges')
        .set('Cookie', director)
        .send({
          kind: 'CLASS_SESSION',
          classSessionId,
          studentId,
          description: `Cargo ${studentId.slice(0, 8)}`,
        });
      expect(chargeRes.status).toBe(201);
      const chargeId = chargeRes.body.charge.id as string;
      const pay = await request(fixture.app)
        .post('/finance/payments')
        .set('Cookie', director)
        .send({
          chargeId,
          provider: 'MANUAL',
          idempotencyKey: `idem-${chargeId}`,
        });
      expect(pay.status).toBe(201);
      const succeeded = await request(fixture.app)
        .post(`/finance/payments/${pay.body.payment.id}/succeed`)
        .set('Cookie', director);
      expect(succeeded.status).toBe(200);
      return {
        chargeId,
        paymentId: pay.body.payment.id as string,
        amountMinor: chargeRes.body.charge.amountMinor as string,
      };
    }

    const mine = await seedPaidCharge(studentA.id, 12500n);
    const theirs = await seedPaidCharge(studentB.id, 9900n);

    await fixture.studentRegistry.createWithNewUser({
      email: 'fin-empty@academia.test',
      passwordHash: await hashPassword('student-password-12'),
      firstName: 'Empty',
      lastName: 'Fin',
      level: 'A1',
      isActive: true,
    });
    const emptyCookie = await loginAs(
      'fin-empty@academia.test',
      'student-password-12',
    );
    const empty = await request(fixture.app)
      .get('/students/me/finance')
      .set('Cookie', emptyCookie!);
    expect(empty.status).toBe(200);
    expect(empty.body.charges).toEqual([]);
    expect(empty.body.payments).toEqual([]);
    expect(empty.body.refunds).toEqual([]);
    expect(empty.body.summary).toMatchObject({
      openCharges: 0,
      paidCharges: 0,
      succeededPayments: 0,
    });

    const cookieA = await loginAs('fin-a@academia.test', 'student-password-12');
    const portal = await request(fixture.app)
      .get('/students/me/finance')
      .set('Cookie', cookieA!);
    expect(portal.status).toBe(200);
    expect(portal.body.charges).toHaveLength(1);
    expect(portal.body.charges[0].id).toBe(mine.chargeId);
    expect(portal.body.charges[0].amountMinor).toBe(mine.amountMinor);
    expect(portal.body.payments).toHaveLength(1);
    expect(portal.body.payments[0].id).toBe(mine.paymentId);
    expect(portal.body.payments[0].status).toBe('SUCCEEDED');
    expect(portal.body.summary.paidCharges).toBe(1);
    expect(portal.body.summary.succeededPayments).toBe(1);

    const raw = JSON.stringify(portal.body);
    expect(raw).not.toMatch(/academyPercentage/);
    expect(raw).not.toMatch(/teacherPercentage/);
    expect(raw).not.toMatch(/teacherAmountMinor/);
    expect(raw).not.toMatch(/createdByUserId/);
    expect(raw).not.toMatch(/idempotencyKey/);
    expect(portal.body.charges[0]).not.toHaveProperty('studentId');
    expect(portal.body.payments[0]).not.toHaveProperty('studentId');

    // Must not include Student B records.
    expect(portal.body.charges.map((c: { id: string }) => c.id)).not.toContain(
      theirs.chargeId,
    );
    expect(
      portal.body.payments.map((p: { id: string }) => p.id),
    ).not.toContain(theirs.paymentId);

    // IDOR via admin finance detail endpoints.
    const idorCharge = await request(fixture.app)
      .get(`/finance/charges/${theirs.chargeId}`)
      .set('Cookie', cookieA!);
    expect([403, 404]).toContain(idorCharge.status);
    const idorPayment = await request(fixture.app)
      .get(`/finance/payments/${theirs.paymentId}`)
      .set('Cookie', cookieA!);
    expect([403, 404]).toContain(idorPayment.status);

    const asDirector = await request(fixture.app)
      .get('/students/me/finance')
      .set('Cookie', director);
    expect(asDirector.status).toBe(403);
  });

  it('POST /students/me/finance/charges/:chargeId/pay is owned, OPEN-only, idempotent', async () => {
    const director = await seedDirector();

    const studentA = await fixture.studentRegistry.createWithNewUser({
      email: 'pay-a@academia.test',
      passwordHash: await hashPassword('student-password-12'),
      firstName: 'Pay',
      lastName: 'A',
      level: 'A1',
      isActive: true,
    });
    const studentB = await fixture.studentRegistry.createWithNewUser({
      email: 'pay-b@academia.test',
      passwordHash: await hashPassword('student-password-12'),
      firstName: 'Pay',
      lastName: 'B',
      level: 'A2',
      isActive: true,
    });
    const teacher = await fixture.teacherRegistry.createWithNewUser({
      email: 'pay-teacher@academia.test',
      passwordHash: await hashPassword('teacher-password-12'),
      firstName: 'Pay',
      lastName: 'Tea',
      level: 'C1',
      availability: 'AVAILABLE',
      isActive: true,
    });

    async function seedOpenCharge(studentId: string, amount: bigint) {
      const classSessionId = randomUUID();
      const groupId = randomUUID();
      const courseId = randomUUID();
      fixture.finance.seedClassSession({
        classSessionId,
        groupId,
        courseId,
        serviceType: 'ONE_TO_ONE_60',
        teacherId: teacher.id,
        courseAmountMinor: amount,
        courseCurrency: 'ARS',
        studentEnrolled: true,
        studentId,
      });
      const chargeRes = await request(fixture.app)
        .post('/finance/charges')
        .set('Cookie', director)
        .send({
          kind: 'CLASS_SESSION',
          classSessionId,
          studentId,
        });
      expect(chargeRes.status).toBe(201);
      return chargeRes.body.charge.id as string;
    }

    const mine = await seedOpenCharge(studentA.id, 12500n);
    const theirs = await seedOpenCharge(studentB.id, 9900n);

    const cookieA = await loginAs('pay-a@academia.test', 'student-password-12');

    const idor = await request(fixture.app)
      .post(`/students/me/finance/charges/${theirs}/pay`)
      .set('Cookie', cookieA!);
    expect(idor.status).toBe(404);

    const first = await request(fixture.app)
      .post(`/students/me/finance/charges/${mine}/pay`)
      .set('Cookie', cookieA!);
    expect(first.status).toBe(201);
    expect(first.body.payment.status).toBe('PENDING');
    expect(first.body.payment.provider).toBe('MERCADOPAGO');
    expect(first.body.payment.chargeId).toBe(mine);
    expect(first.body.payment).not.toHaveProperty('studentId');
    expect(first.body.payment).not.toHaveProperty('idempotencyKey');
    expect(JSON.stringify(first.body)).not.toMatch(/academyPercentage/);

    const second = await request(fixture.app)
      .post(`/students/me/finance/charges/${mine}/pay`)
      .set('Cookie', cookieA!);
    expect(second.status).toBe(201);
    expect(second.body.payment.id).toBe(first.body.payment.id);

    const portal = await request(fixture.app)
      .get('/students/me/finance')
      .set('Cookie', cookieA!);
    expect(portal.status).toBe(200);
    expect(portal.body.charges[0].status).toBe('OPEN');
    expect(portal.body.payments).toHaveLength(1);
    expect(portal.body.payments[0].status).toBe('PENDING');

    const webhook = await request(fixture.app)
      .post('/finance/webhooks/mercado-pago')
      .send({
        providerEventId: `evt_${randomUUID()}`,
        type: 'payment.succeeded',
        paymentId: first.body.payment.id,
      });
    expect(webhook.status).toBe(200);
    expect(webhook.body.processed).toBe(true);

    const after = await request(fixture.app)
      .get('/students/me/finance')
      .set('Cookie', cookieA!);
    expect(after.body.charges[0].status).toBe('PAID');
    expect(after.body.payments[0].status).toBe('SUCCEEDED');

    // Charge is PAID → OPEN guard (400), not a second Payment.
    const restart = await request(fixture.app)
      .post(`/students/me/finance/charges/${mine}/pay`)
      .set('Cookie', cookieA!);
    expect(restart.status).toBe(400);

    const asDirector = await request(fixture.app)
      .post(`/students/me/finance/charges/${mine}/pay`)
      .set('Cookie', director);
    expect(asDirector.status).toBe(403);
  });
});
