import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createChargeForClassSession,
  createChargeForEnrollmentPeriod,
} from '../domain/finance/charge-service.js';
import {
  getOrCreateFinanceSettings,
  updateFinanceSettings,
} from '../domain/finance/finance-settings-service.js';
import { createFinanceStore } from '../domain/finance/prisma-finance-store.js';
import {
  createPayment,
  succeedPayment,
} from '../domain/finance/payment-service.js';
import { confirmTotalRefund } from '../domain/finance/refund-service.js';
import {
  calculateTeacherOwed,
  createTeacherSettlement,
  markTeacherSettlementPaid,
} from '../domain/finance/settlement-service.js';
import { FinanceConflictError } from '../domain/finance/finance-errors.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

const PREFIX = 'finance-integration';

describe('finance integration', () => {
  let database: Database;

  beforeAll(() => {
    database = createPrismaClient(DATABASE_URL);
  });

  afterAll(async () => {
    await cleanup();
    await database.$disconnect();
  });

  beforeEach(async () => {
    await cleanup();
  });

  async function cleanup() {
    await database.revenueAllocation.deleteMany({
      where: {
        OR: [
          { student: { user: { email: { startsWith: PREFIX } } } },
          { teacher: { user: { email: { startsWith: PREFIX } } } },
        ],
      },
    });
    await database.refund.deleteMany({
      where: { payment: { student: { user: { email: { startsWith: PREFIX } } } } },
    });
    await database.payment.deleteMany({
      where: { student: { user: { email: { startsWith: PREFIX } } } },
    });
    await database.charge.deleteMany({
      where: { student: { user: { email: { startsWith: PREFIX } } } },
    });
    await database.teacherSettlement.deleteMany({
      where: { teacher: { user: { email: { startsWith: PREFIX } } } },
    });
    await database.webhookEvent.deleteMany({
      where: { providerEventId: { startsWith: PREFIX } },
    });
    await database.attendance.deleteMany({
      where: { student: { user: { email: { startsWith: PREFIX } } } },
    });
    await database.classSession.deleteMany({
      where: { group: { course: { name: { startsWith: PREFIX } } } },
    });
    await database.enrollment.deleteMany({
      where: { student: { user: { email: { startsWith: PREFIX } } } },
    });
    await database.group.deleteMany({
      where: { course: { name: { startsWith: PREFIX } } },
    });
    await database.course.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await database.teacherAssignment.deleteMany({
      where: {
        OR: [
          { teacher: { user: { email: { startsWith: PREFIX } } } },
          { student: { user: { email: { startsWith: PREFIX } } } },
        ],
      },
    });
    await database.student.deleteMany({
      where: { user: { email: { startsWith: PREFIX } } },
    });
    await database.teacher.deleteMany({
      where: { user: { email: { startsWith: PREFIX } } },
    });
    await database.academyFinanceSettings.deleteMany({});
    await database.user.deleteMany({
      where: { email: { startsWith: PREFIX } },
    });
  }

  async function seedOneToOne() {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const director = await database.user.create({
      data: {
        email: `${PREFIX}-director@academia.test`,
        name: 'Finance Director',
        passwordHash,
        role: 'DIRECTOR',
        isActive: true,
      },
    });
    const teacherUser = await database.user.create({
      data: {
        email: `${PREFIX}-teacher-a@academia.test`,
        name: 'Teacher A',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
        teacher: {
          create: {
            firstName: 'Teach',
            lastName: 'A',
            level: 'C1',
            availability: 'AVAILABLE',
            isActive: true,
          },
        },
      },
      include: { teacher: true },
    });
    const teacherBUser = await database.user.create({
      data: {
        email: `${PREFIX}-teacher-b@academia.test`,
        name: 'Teacher B',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
        teacher: {
          create: {
            firstName: 'Teach',
            lastName: 'B',
            level: 'C1',
            availability: 'AVAILABLE',
            isActive: true,
          },
        },
      },
      include: { teacher: true },
    });
    const studentUser = await database.user.create({
      data: {
        email: `${PREFIX}-student@academia.test`,
        name: 'Student',
        passwordHash,
        role: 'STUDENT',
        isActive: true,
        student: {
          create: {
            firstName: 'Stu',
            lastName: 'Dent',
            level: 'A2',
            isActive: true,
          },
        },
      },
      include: { student: true },
    });

    const course = await database.course.create({
      data: {
        name: `${PREFIX}-oto`,
        description: null,
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
        amountMinor: 10001n,
        currency: 'ARS',
        isActive: true,
      },
    });
    const group = await database.group.create({
      data: {
        courseId: course.id,
        name: `${PREFIX}-group`,
        teacherId: teacherUser.teacher!.id,
        isActive: true,
      },
    });
    await database.enrollment.create({
      data: {
        groupId: group.id,
        studentId: studentUser.student!.id,
        isActive: true,
      },
    });
    const session = await database.classSession.create({
      data: {
        groupId: group.id,
        startAt: new Date('2026-09-20T15:00:00.000Z'),
        endAt: new Date('2026-09-20T16:00:00.000Z'),
        isActive: true,
      },
    });

    return {
      director,
      teacherAId: teacherUser.teacher!.id,
      teacherBId: teacherBUser.teacher!.id,
      studentId: studentUser.student!.id,
      course,
      group,
      session,
    };
  }

  it('persists freeze, rounding remainder, teacher freeze, refund, settlement', async () => {
    const seeded = await seedOneToOne();
    const store = createFinanceStore(database);

    await updateFinanceSettings(store, {
      academyPercentage: 40,
      updatedByUserId: seeded.director.id,
    });

    const charge = await createChargeForClassSession(store, {
      classSessionId: seeded.session.id,
      studentId: seeded.studentId,
      createdByUserId: seeded.director.id,
    });
    expect(charge.amountMinor).toBe(10001n);

    await database.course.update({
      where: { id: seeded.course.id },
      data: { amountMinor: 77777n },
    });
    const chargeRow = await database.charge.findUnique({
      where: { id: charge.id },
    });
    expect(chargeRow?.amountMinor).toBe(10001n);

    const payment = await createPayment(store, {
      chargeId: charge.id,
      provider: 'MERCADOPAGO',
      idempotencyKey: `${PREFIX}-pay-1`,
      providerPaymentId: `${PREFIX}-prov-1`,
    });

    const succeeded = await succeedPayment(store, payment.id);
    expect(succeeded.allocation.academyAmountMinor).toBe(4000n);
    expect(succeeded.allocation.teacherAmountMinor).toBe(6001n);
    expect(
      succeeded.allocation.academyAmountMinor +
        succeeded.allocation.teacherAmountMinor,
    ).toBe(10001n);
    expect(succeeded.allocation.teacherId).toBe(seeded.teacherAId);

    await updateFinanceSettings(store, {
      academyPercentage: 50,
      updatedByUserId: seeded.director.id,
    });
    await database.group.update({
      where: { id: seeded.group.id },
      data: { teacherId: seeded.teacherBId },
    });

    const allocation = await database.revenueAllocation.findUnique({
      where: {
        paymentId_kind: { paymentId: payment.id, kind: 'ORIGINAL' },
      },
    });
    expect(allocation?.academyPercentage).toBe(40);
    expect(allocation?.teacherId).toBe(seeded.teacherAId);

    const refunded = await confirmTotalRefund(store, {
      paymentId: payment.id,
      reason: 'test',
      createdByUserId: seeded.director.id,
    });
    expect(refunded.reversalAllocation.amountMinor).toBe(-10001n);
    expect(refunded.originalAllocation.amountMinor).toBe(10001n);

    const owed = await calculateTeacherOwed(store, {
      teacherId: seeded.teacherAId,
      periodStart: new Date('2020-01-01'),
      periodEnd: new Date('2030-01-01'),
      currency: 'ARS',
    });
    expect(owed).toBe(0n);

    const settlement = await createTeacherSettlement(store, {
      teacherId: seeded.teacherAId,
      periodStart: new Date('2020-01-01'),
      periodEnd: new Date('2030-01-01'),
      currency: 'ARS',
    });
    const marked = await markTeacherSettlementPaid(store, settlement.id);
    expect(marked.status).toBe('MARKED_PAID');
  });

  it('rolls back SUCCEEDED when allocation insert fails', async () => {
    const seeded = await seedOneToOne();
    let shouldFail = true;
    const store = createFinanceStore(database, {
      beforeCreateAllocationHook: () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('simulated allocation failure');
        }
      },
    });

    await getOrCreateFinanceSettings(store);
    const charge = await createChargeForClassSession(store, {
      classSessionId: seeded.session.id,
      studentId: seeded.studentId,
      createdByUserId: seeded.director.id,
    });
    const payment = await createPayment(store, {
      chargeId: charge.id,
      provider: 'MERCADOPAGO',
      idempotencyKey: `${PREFIX}-atomic`,
    });

    await expect(succeedPayment(store, payment.id)).rejects.toThrow(
      'simulated allocation failure',
    );

    const paymentRow = await database.payment.findUnique({
      where: { id: payment.id },
    });
    const chargeRow = await database.charge.findUnique({
      where: { id: charge.id },
    });
    const allocationCount = await database.revenueAllocation.count({
      where: { paymentId: payment.id },
    });
    expect(paymentRow?.status).toBe('PENDING');
    expect(chargeRow?.status).toBe('OPEN');
    expect(allocationCount).toBe(0);
  });

  it('enforces payment idempotency and webhook uniqueness', async () => {
    const seeded = await seedOneToOne();
    const store = createFinanceStore(database);
    await getOrCreateFinanceSettings(store);

    const charge = await createChargeForClassSession(store, {
      classSessionId: seeded.session.id,
      studentId: seeded.studentId,
      createdByUserId: seeded.director.id,
    });
    const first = await createPayment(store, {
      chargeId: charge.id,
      provider: 'MERCADOPAGO',
      idempotencyKey: `${PREFIX}-idem`,
      providerPaymentId: `${PREFIX}-prov-idem`,
    });
    const second = await createPayment(store, {
      chargeId: charge.id,
      provider: 'MERCADOPAGO',
      idempotencyKey: `${PREFIX}-idem`,
    });
    expect(second.id).toBe(first.id);

    const event = await store.createWebhookEvent({
      provider: 'MERCADOPAGO',
      providerEventId: `${PREFIX}-evt-1`,
      payload: { ok: true },
    });
    expect(event.providerEventId).toBe(`${PREFIX}-evt-1`);

    await expect(
      store.createWebhookEvent({
        provider: 'MERCADOPAGO',
        providerEventId: `${PREFIX}-evt-1`,
        payload: { ok: false },
      }),
    ).rejects.toBeInstanceOf(FinanceConflictError);
  });

  it('creates GROUP_120 enrollment-period charge', async () => {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const director = await database.user.create({
      data: {
        email: `${PREFIX}-group-director@academia.test`,
        name: 'Director',
        passwordHash,
        role: 'DIRECTOR',
        isActive: true,
      },
    });
    const teacherUser = await database.user.create({
      data: {
        email: `${PREFIX}-group-teacher@academia.test`,
        name: 'Teacher',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
        teacher: {
          create: {
            firstName: 'G',
            lastName: 'T',
            level: 'C1',
            availability: 'AVAILABLE',
            isActive: true,
          },
        },
      },
      include: { teacher: true },
    });
    const studentUser = await database.user.create({
      data: {
        email: `${PREFIX}-group-student@academia.test`,
        name: 'Student',
        passwordHash,
        role: 'STUDENT',
        isActive: true,
        student: {
          create: {
            firstName: 'G',
            lastName: 'S',
            level: 'B1',
            isActive: true,
          },
        },
      },
      include: { student: true },
    });
    const course = await database.course.create({
      data: {
        name: `${PREFIX}-group-course`,
        description: null,
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
        amountMinor: 80000n,
        currency: 'USD',
        isActive: true,
      },
    });
    const group = await database.group.create({
      data: {
        courseId: course.id,
        name: `${PREFIX}-group-cohort`,
        teacherId: teacherUser.teacher!.id,
        isActive: true,
      },
    });
    const enrollment = await database.enrollment.create({
      data: {
        groupId: group.id,
        studentId: studentUser.student!.id,
        isActive: true,
      },
    });

    const store = createFinanceStore(database);
    const charge = await createChargeForEnrollmentPeriod(store, {
      enrollmentId: enrollment.id,
      periodStart: new Date('2026-09-01'),
      periodEnd: new Date('2026-10-01'),
      createdByUserId: director.id,
    });
    expect(charge.currency).toBe('USD');
    expect(charge.enrollmentId).toBe(enrollment.id);
    expect(charge.classSessionId).toBeNull();

    const payment = await createPayment(store, {
      chargeId: charge.id,
      provider: 'STRIPE',
      idempotencyKey: `${PREFIX}-group-pay`,
    });
    expect(payment.provider).toBe('STRIPE');
  });

  it('auto-charge ONE_TO_ONE is idempotent under PostgreSQL unique index', async () => {
    const seeded = await seedOneToOne();
    const store = createFinanceStore(database);
    const { ensureAutoChargeForClassSession } = await import(
      '../domain/finance/auto-charge.js'
    );

    const first = await ensureAutoChargeForClassSession(store, {
      classSessionId: seeded.session.id,
      createdByUserId: seeded.director.id,
    });
    expect(first).not.toBeNull();
    expect(first!.amountMinor).toBe(10001n);

    const [a, b] = await Promise.all([
      ensureAutoChargeForClassSession(store, {
        classSessionId: seeded.session.id,
        createdByUserId: seeded.director.id,
      }),
      createChargeForClassSession(store, {
        classSessionId: seeded.session.id,
        studentId: seeded.studentId,
        createdByUserId: seeded.director.id,
      }),
    ]);
    expect(a!.id).toBe(first!.id);
    expect(b.id).toBe(first!.id);

    const count = await database.charge.count({
      where: { classSessionId: seeded.session.id },
    });
    expect(count).toBe(1);
  });

  it('auto-charge GROUP_120 month is idempotent under PostgreSQL unique index', async () => {
    const passwordHash = await hashPassword('irrelevant-password-12');
    const director = await database.user.create({
      data: {
        email: `${PREFIX}-auto-group-dir@academia.test`,
        name: 'Dir',
        passwordHash,
        role: 'DIRECTOR',
        isActive: true,
      },
    });
    const teacherUser = await database.user.create({
      data: {
        email: `${PREFIX}-auto-group-t@academia.test`,
        name: 'T',
        passwordHash,
        role: 'TEACHER',
        isActive: true,
        teacher: {
          create: {
            firstName: 'T',
            lastName: 'G',
            level: 'C1',
            availability: 'AVAILABLE',
            isActive: true,
          },
        },
      },
      include: { teacher: true },
    });
    const studentUser = await database.user.create({
      data: {
        email: `${PREFIX}-auto-group-s@academia.test`,
        name: 'S',
        passwordHash,
        role: 'STUDENT',
        isActive: true,
        student: {
          create: {
            firstName: 'S',
            lastName: 'G',
            level: 'B1',
            isActive: true,
          },
        },
      },
      include: { student: true },
    });
    const course = await database.course.create({
      data: {
        name: `${PREFIX}-auto-group-course`,
        description: null,
        courseType: 'REGULAR',
        serviceType: 'GROUP_120',
        amountMinor: 80000n,
        currency: 'ARS',
        isActive: true,
      },
    });
    const group = await database.group.create({
      data: {
        courseId: course.id,
        name: `${PREFIX}-auto-group`,
        teacherId: teacherUser.teacher!.id,
        isActive: true,
      },
    });
    const enrollment = await database.enrollment.create({
      data: {
        groupId: group.id,
        studentId: studentUser.student!.id,
        isActive: true,
      },
    });

    const store = createFinanceStore(database);
    const { ensureAutoChargeForEnrollmentMonth } = await import(
      '../domain/finance/auto-charge.js'
    );
    const { DEFAULT_ACADEMY_TIMEZONE } = await import('@academia/shared');
    const now = new Date('2026-09-15T18:00:00.000Z');

    const first = await ensureAutoChargeForEnrollmentMonth(store, {
      enrollmentId: enrollment.id,
      createdByUserId: director.id,
      businessTimezone: DEFAULT_ACADEMY_TIMEZONE,
      now,
    });
    expect(first).not.toBeNull();

    const second = await ensureAutoChargeForEnrollmentMonth(store, {
      enrollmentId: enrollment.id,
      createdByUserId: director.id,
      businessTimezone: DEFAULT_ACADEMY_TIMEZONE,
      now,
    });
    expect(second!.id).toBe(first!.id);

    const count = await database.charge.count({
      where: { enrollmentId: enrollment.id },
    });
    expect(count).toBe(1);
  });

  it('student finance portal only returns the authenticated student rows', async () => {
    const seededA = await seedOneToOne();
    const store = createFinanceStore(database);
    await getOrCreateFinanceSettings(store);

    const chargeA = await createChargeForClassSession(store, {
      classSessionId: seededA.session.id,
      studentId: seededA.studentId,
      createdByUserId: seededA.director.id,
    });
    const paymentA = await createPayment(store, {
      chargeId: chargeA.id,
      provider: 'MANUAL',
      idempotencyKey: `${PREFIX}-portal-a`,
    });
    await succeedPayment(store, paymentA.id);

    const passwordHash = await hashPassword('student-password-12');
    const otherUser = await database.user.create({
      data: {
        email: `${PREFIX}-portal-b@academia.test`,
        passwordHash,
        role: 'STUDENT',
        isActive: true,
        student: {
          create: {
            firstName: 'Other',
            lastName: 'Student',
            level: 'A2',
            isActive: true,
          },
        },
      },
      include: { student: true },
    });
    const studentBId = otherUser.student!.id;

    const courseB = await database.course.create({
      data: {
        name: `${PREFIX}-portal-b-course`,
        courseType: 'REGULAR',
        serviceType: 'ONE_TO_ONE_60',
        amountMinor: 5000n,
        currency: 'ARS',
        isActive: true,
      },
    });
    const teacherB = await database.teacher.findFirst({
      where: { id: seededA.teacherAId },
    });
    const groupB = await database.group.create({
      data: {
        courseId: courseB.id,
        name: `${PREFIX}-portal-b-group`,
        teacherId: teacherB!.id,
        isActive: true,
      },
    });
    await database.enrollment.create({
      data: {
        groupId: groupB.id,
        studentId: studentBId,
        isActive: true,
      },
    });
    const sessionB = await database.classSession.create({
      data: {
        groupId: groupB.id,
        startAt: new Date('2026-09-22T15:00:00.000Z'),
        endAt: new Date('2026-09-22T16:00:00.000Z'),
        isActive: true,
      },
    });
    const chargeB = await createChargeForClassSession(store, {
      classSessionId: sessionB.id,
      studentId: studentBId,
      createdByUserId: seededA.director.id,
    });

    const { getStudentFinancePortal } = await import(
      '../domain/finance/student-finance-portal.js'
    );
    const portalA = await getStudentFinancePortal(store, seededA.studentId);
    expect(portalA.charges.map((c) => c.id)).toEqual([chargeA.id]);
    expect(portalA.payments).toHaveLength(1);
    expect(portalA.payments[0]?.status).toBe('SUCCEEDED');
    expect(portalA.charges.map((c) => c.id)).not.toContain(chargeB.id);
    const raw = JSON.stringify(portalA);
    expect(raw).not.toMatch(/academyPercentage/);
    expect(raw).not.toMatch(/teacherAmountMinor/);
    expect(raw).not.toMatch(/createdByUserId/);

    const portalB = await getStudentFinancePortal(store, studentBId);
    expect(portalB.charges.map((c) => c.id)).toEqual([chargeB.id]);
    expect(portalB.payments).toHaveLength(0);
  });
});
