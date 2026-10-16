import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('Finance HTTP API (Stage 6B-2)', () => {
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
      id: 'director-fin-1',
      email: 'directora@academia.test',
      name: 'Directora',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );
    return cookie!;
  }

  it('rejects anonymous finance settings with 401', async () => {
    expect((await request(fixture.app).get('/finance/settings')).status).toBe(
      401,
    );
  });

  it('lets DIRECTOR read and patch academyPercentage; rejects invalid %', async () => {
    const cookie = await seedDirector();

    const got = await request(fixture.app)
      .get('/finance/settings')
      .set('Cookie', cookie);
    expect(got.status).toBe(200);
    expect(got.body.settings).toEqual({
      academyPercentage: 40,
      teacherPercentage: 60,
    });

    const patched = await request(fixture.app)
      .patch('/finance/settings')
      .set('Cookie', cookie)
      .send({ academyPercentage: 30 });
    expect(patched.status).toBe(200);
    expect(patched.body.settings).toEqual({
      academyPercentage: 30,
      teacherPercentage: 70,
    });

    const bad = await request(fixture.app)
      .patch('/finance/settings')
      .set('Cookie', cookie)
      .send({ academyPercentage: 25 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_REQUEST');
  });

  it('forbids ADMINISTRATIVE from patching settings even with finance.update', async () => {
    fixture.users.seed({
      id: 'admin-fin-1',
      email: 'admin@academia.test',
      name: 'Admin',
      role: 'ADMINISTRATIVE',
      isActive: true,
      passwordHash: await hashPassword('admin-password-12'),
    });
    fixture.administrativePermissions.grantRole(
      'ADMINISTRATIVE',
      'finance',
      'update',
    );
    fixture.administrativePermissions.grantRole(
      'ADMINISTRATIVE',
      'finance',
      'read',
    );
    await fixture.administrativePermissions.grant('finance', 'update');
    await fixture.administrativePermissions.grant('finance', 'read');

    const cookie = await loginAs('admin@academia.test', 'admin-password-12');

    const read = await request(fixture.app)
      .get('/finance/settings')
      .set('Cookie', cookie!);
    expect(read.status).toBe(200);

    const patch = await request(fixture.app)
      .patch('/finance/settings')
      .set('Cookie', cookie!)
      .send({ academyPercentage: 20 });
    expect(patch.status).toBe(403);
  });

  it('runs MANUAL charge → payment → succeed → allocation freeze + refund', async () => {
    const cookie = await seedDirector();

    const student = await fixture.studentRegistry.createWithNewUser({
      email: 'alumno@academia.test',
      passwordHash: await hashPassword('student-password-12'),
      firstName: 'Ana',
      lastName: 'Lopez',
      level: 'A1',
      isActive: true,
    });
    const teacher = await fixture.teacherRegistry.createWithNewUser({
      email: 'docente@academia.test',
      passwordHash: await hashPassword('teacher-password-12'),
      firstName: 'Tito',
      lastName: 'Garcia',
      level: 'B2',
      availability: 'AVAILABLE',
      isActive: true,
    });

    const courseId = randomUUID();
    const groupId = randomUUID();
    const classSessionId = randomUUID();

    fixture.finance.seedClassSession({
      classSessionId,
      groupId,
      courseId,
      serviceType: 'ONE_TO_ONE_60',
      teacherId: teacher.id,
      courseAmountMinor: 10000n,
      courseCurrency: 'ARS',
      studentEnrolled: true,
      studentId: student.id,
    });

    const chargeRes = await request(fixture.app)
      .post('/finance/charges')
      .set('Cookie', cookie)
      .send({
        kind: 'CLASS_SESSION',
        classSessionId,
        studentId: student.id,
      });
    expect(chargeRes.status).toBe(201);
    expect(chargeRes.body.charge.amountMinor).toBe('10000');
    expect(chargeRes.body.charge.status).toBe('OPEN');
    const chargeId = chargeRes.body.charge.id as string;

    const idem = `idem-${randomUUID()}`;
    const pay1 = await request(fixture.app)
      .post('/finance/payments')
      .set('Cookie', cookie)
      .send({
        chargeId,
        provider: 'MANUAL',
        idempotencyKey: idem,
      });
    expect(pay1.status).toBe(201);
    expect(pay1.body.payment.status).toBe('PENDING');
    const paymentId = pay1.body.payment.id as string;

    const payReplay = await request(fixture.app)
      .post('/finance/payments')
      .set('Cookie', cookie)
      .send({
        chargeId,
        provider: 'MANUAL',
        idempotencyKey: idem,
      });
    expect(payReplay.status).toBe(201);
    expect(payReplay.body.payment.id).toBe(paymentId);

    const succeeded = await request(fixture.app)
      .post(`/finance/payments/${paymentId}/succeed`)
      .set('Cookie', cookie);
    expect(succeeded.status).toBe(200);
    expect(succeeded.body.payment.status).toBe('SUCCEEDED');

    const allocations = await request(fixture.app)
      .get('/finance/allocations')
      .query({ paymentId })
      .set('Cookie', cookie);
    expect(allocations.status).toBe(200);
    expect(allocations.body.allocations).toHaveLength(1);
    expect(allocations.body.allocations[0]).toMatchObject({
      kind: 'ORIGINAL',
      academyPercentage: 40,
      academyAmountMinor: '4000',
      teacherAmountMinor: '6000',
      teacherId: teacher.id,
    });

    await request(fixture.app)
      .patch('/finance/settings')
      .set('Cookie', cookie)
      .send({ academyPercentage: 50 });

    const allocAgain = await request(fixture.app)
      .get(`/finance/allocations/${allocations.body.allocations[0].id}`)
      .set('Cookie', cookie);
    expect(allocAgain.body.allocation.academyPercentage).toBe(40);

    const refund = await request(fixture.app)
      .post(`/finance/payments/${paymentId}/refunds`)
      .set('Cookie', cookie)
      .send({ reason: 'test refund' });
    expect(refund.status).toBe(201);
    expect(refund.body.payment.status).toBe('REFUNDED');

    const afterRefund = await request(fixture.app)
      .get('/finance/allocations')
      .query({ paymentId })
      .set('Cookie', cookie);
    expect(afterRefund.body.allocations).toHaveLength(2);
    const kinds = afterRefund.body.allocations.map(
      (row: { kind: string }) => row.kind,
    );
    expect(kinds).toEqual(expect.arrayContaining(['ORIGINAL', 'REVERSAL']));
  });

  it('processes stripe webhook idempotently', async () => {
    const cookie = await seedDirector();
    const student = await fixture.studentRegistry.createWithNewUser({
      email: 'alumno2@academia.test',
      passwordHash: await hashPassword('student-password-12'),
      firstName: 'Bea',
      lastName: 'Ruiz',
      level: 'A2',
      isActive: true,
    });
    const teacher = await fixture.teacherRegistry.createWithNewUser({
      email: 'docente2@academia.test',
      passwordHash: await hashPassword('teacher-password-12'),
      firstName: 'Cora',
      lastName: 'Diaz',
      level: 'C1',
      availability: 'AVAILABLE',
      isActive: true,
    });

    const courseId = randomUUID();
    const groupId = randomUUID();
    const classSessionId = randomUUID();

    fixture.finance.seedClassSession({
      classSessionId,
      groupId,
      courseId,
      serviceType: 'ONE_TO_ONE_60',
      teacherId: teacher.id,
      courseAmountMinor: 5000n,
      courseCurrency: 'USD',
      studentEnrolled: true,
      studentId: student.id,
    });

    const chargeRes = await request(fixture.app)
      .post('/finance/charges')
      .set('Cookie', cookie)
      .send({
        kind: 'CLASS_SESSION',
        classSessionId,
        studentId: student.id,
      });
    const chargeId = chargeRes.body.charge.id as string;

    const pay = await request(fixture.app)
      .post('/finance/payments')
      .set('Cookie', cookie)
      .send({
        chargeId,
        provider: 'STRIPE',
        idempotencyKey: `stripe-idem-${randomUUID()}`,
      });
    const paymentId = pay.body.payment.id as string;

    const eventId = `evt_${randomUUID()}`;
    const first = await request(fixture.app)
      .post('/finance/webhooks/stripe')
      .send({
        providerEventId: eventId,
        type: 'payment.succeeded',
        paymentId,
      });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      received: true,
      duplicate: false,
      processed: true,
    });

    const second = await request(fixture.app)
      .post('/finance/webhooks/stripe')
      .send({
        providerEventId: eventId,
        type: 'payment.succeeded',
        paymentId,
      });
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    const got = await request(fixture.app)
      .get(`/finance/payments/${paymentId}`)
      .set('Cookie', cookie);
    expect(got.body.payment.status).toBe('SUCCEEDED');

    const allocs = await request(fixture.app)
      .get('/finance/allocations')
      .query({ paymentId })
      .set('Cookie', cookie);
    expect(allocs.body.allocations).toHaveLength(1);
  });

  it('forbids TEACHER from reading another teacher settlement', async () => {
    const cookie = await seedDirector();
    const teacherA = await fixture.teacherRegistry.createWithNewUser({
      email: 'tea-a@academia.test',
      passwordHash: await hashPassword('teacher-password-12'),
      firstName: 'A',
      lastName: 'One',
      level: 'B1',
      availability: 'AVAILABLE',
      isActive: true,
    });
    const teacherB = await fixture.teacherRegistry.createWithNewUser({
      email: 'tea-b@academia.test',
      passwordHash: await hashPassword('teacher-password-12'),
      firstName: 'B',
      lastName: 'Two',
      level: 'B2',
      availability: 'AVAILABLE',
      isActive: true,
    });

    const periodStart = new Date('2026-09-01T00:00:00.000Z');
    const periodEnd = new Date('2026-10-01T00:00:00.000Z');
    const settlement = await request(fixture.app)
      .post('/finance/settlements')
      .set('Cookie', cookie)
      .send({
        teacherId: teacherB.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        currency: 'ARS',
      });
    expect(settlement.status).toBe(201);

    const teaCookie = await loginAs(
      'tea-a@academia.test',
      'teacher-password-12',
    );
    expect(teacherA.id).toBeTruthy();
    const forbidden = await request(fixture.app)
      .get(`/finance/settlements/${settlement.body.settlement.id}`)
      .set('Cookie', teaCookie!);
    expect(forbidden.status).toBe(403);
  });
});

describe('Mercado Pago native webhook HTTP', () => {
  const MP_SECRET = 'mp_http_whsec';
  const MP_TOKEN = 'TEST-http-token';
  let fixture: TestApp;

  beforeEach(async () => {
    fixture = await buildTestApp({
      paymentCredentials: {
        mercadopagoAccessToken: MP_TOKEN,
        mercadopagoWebhookSecret: MP_SECRET,
        stripeSecretKey: '',
        stripeWebhookSecret: '',
        appPublicUrl: 'http://localhost:3000',
        apiPublicUrl: 'https://abc.ngrok-free.app',
        requireWebhookSignature: true,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sign(dataId: string, requestId: string, ts: string): string {
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac('sha256', MP_SECRET).update(manifest).digest('hex');
    return `ts=${ts},v1=${v1}`;
  }

  async function seedPendingMpPayment(): Promise<{
    cookie: string;
    paymentId: string;
    chargeId: string;
  }> {
    fixture.users.seed({
      id: 'director-mp-1',
      email: 'dir-mp@academia.test',
      name: 'Dir',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword('director-password-12'),
    });
    const login = await request(fixture.app)
      .post('/auth/login')
      .send({ email: 'dir-mp@academia.test', password: 'director-password-12' });
    const cookie = cookieFrom(login.headers['set-cookie'], SESSION_COOKIE)!;

    const student = await fixture.studentRegistry.createWithNewUser({
      email: 'mp-student@academia.test',
      passwordHash: await hashPassword('student-password-12'),
      firstName: 'Mp',
      lastName: 'Stu',
      level: 'A1',
      isActive: true,
    });
    const teacher = await fixture.teacherRegistry.createWithNewUser({
      email: 'mp-teacher@academia.test',
      passwordHash: await hashPassword('teacher-password-12'),
      firstName: 'Mp',
      lastName: 'Tea',
      level: 'C1',
      availability: 'AVAILABLE',
      isActive: true,
    });
    const classSessionId = randomUUID();
    const courseId = randomUUID();
    const groupId = randomUUID();
    fixture.finance.seedClassSession({
      classSessionId,
      groupId,
      courseId,
      serviceType: 'ONE_TO_ONE_60',
      teacherId: teacher.id,
      courseAmountMinor: 12500n,
      courseCurrency: 'ARS',
      studentEnrolled: true,
      studentId: student.id,
    });
    const chargeRes = await request(fixture.app)
      .post('/finance/charges')
      .set('Cookie', cookie)
      .send({
        kind: 'CLASS_SESSION',
        classSessionId,
        studentId: student.id,
      });
    const chargeId = chargeRes.body.charge.id as string;
    const pay = await request(fixture.app)
      .post('/finance/payments')
      .set('Cookie', cookie)
      .send({
        chargeId,
        provider: 'MERCADOPAGO',
        idempotencyKey: `mp-http-${chargeId}`,
        providerPaymentId: 'pref_http_1',
      });
    return { cookie, paymentId: pay.body.payment.id as string, chargeId };
  }

  it('rejects invalid signature with 401', async () => {
    const { chargeId } = await seedPendingMpPayment();
    const res = await request(fixture.app)
      .post('/finance/webhooks/mercado-pago')
      .set('x-signature', 'ts=1,v1=deadbeef')
      .set('x-request-id', 'req-1')
      .send({
        id: 1,
        type: 'payment',
        data: { id: '555' },
        // ensure we are not treated as legacy inbox
        external_reference: chargeId,
      });
    expect(res.status).toBe(401);
  });

  it('rejects missing signature when secret is configured', async () => {
    await seedPendingMpPayment();
    const res = await request(fixture.app)
      .post('/finance/webhooks/mercado-pago')
      .send({ id: 1, type: 'payment', data: { id: '555' } });
    expect(res.status).toBe(401);
  });

  it('rejects legacy inbox when live MP credentials are set', async () => {
    const { paymentId } = await seedPendingMpPayment();
    const res = await request(fixture.app)
      .post('/finance/webhooks/mercado-pago')
      .send({
        providerEventId: 'legacy-1',
        type: 'payment.succeeded',
        paymentId,
      });
    expect(res.status).toBe(400);
  });

  it('approves after provider fetch with valid signature', async () => {
    const { cookie, paymentId, chargeId } = await seedPendingMpPayment();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 777001,
          status: 'approved',
          transaction_amount: 125,
          currency_id: 'ARS',
          external_reference: chargeId,
        }),
      }),
    );
    const ts = '1700000000';
    const dataId = '777001';
    const requestId = 'req-ok';
    const res = await request(fixture.app)
      .post('/finance/webhooks/mercado-pago')
      .set('x-signature', sign(dataId, requestId, ts))
      .set('x-request-id', requestId)
      .send({
        id: 42,
        type: 'payment',
        action: 'payment.updated',
        data: { id: dataId },
      });
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(true);

    const got = await request(fixture.app)
      .get(`/finance/payments/${paymentId}`)
      .set('Cookie', cookie);
    expect(got.body.payment.status).toBe('SUCCEEDED');
  });

  it('blocks anonymous succeed on MERCADOPAGO payments', async () => {
    const { cookie, paymentId } = await seedPendingMpPayment();
    const anon = await request(fixture.app).post(
      `/finance/payments/${paymentId}/succeed`,
    );
    expect(anon.status).toBe(401);
    const director = await request(fixture.app)
      .post(`/finance/payments/${paymentId}/succeed`)
      .set('Cookie', cookie);
    expect(director.status).toBe(400);
  });
});
