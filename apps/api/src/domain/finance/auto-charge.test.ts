import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DEFAULT_ACADEMY_TIMEZONE } from '@academia/shared';
import {
  ensureAutoChargeForClassSession,
  ensureAutoChargeForEnrollmentMonth,
} from './auto-charge.js';
import { calendarMonthPeriodForTimezone } from './calendar-month-period.js';
import {
  createChargeForClassSession,
  createChargeForEnrollmentPeriod,
} from './charge-service.js';
import {
  getOrCreateFinanceSettings,
  updateFinanceSettings,
} from './finance-settings-service.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import { createPayment, succeedPayment } from './payment-service.js';

const teacherA = randomUUID();
const studentId = randomUUID();
const courseId = randomUUID();
const groupId = randomUUID();
const classSessionId = randomUUID();
const enrollmentId = randomUUID();
const actorUserId = randomUUID();

describe('auto-charge', () => {
  const store = createInMemoryFinanceStore();

  beforeEach(() => {
    store.clear();
    store.seedClassSession({
      classSessionId,
      studentId,
      groupId,
      courseId,
      serviceType: 'ONE_TO_ONE_60',
      teacherId: teacherA,
      courseAmountMinor: 10000n,
      courseCurrency: 'ARS',
      studentEnrolled: true,
    });
    store.seedEnrollment({
      enrollmentId,
      studentId,
      groupId,
      courseId: randomUUID(),
      serviceType: 'GROUP_120',
      teacherId: teacherA,
      courseAmountMinor: 50000n,
      courseCurrency: 'ARS',
    });
  });

  describe('ONE_TO_ONE ClassSession', () => {
    it('creates a Charge on ensure and is idempotent', async () => {
      const first = await ensureAutoChargeForClassSession(store, {
        classSessionId,
        createdByUserId: actorUserId,
      });
      expect(first).not.toBeNull();
      expect(first!.amountMinor).toBe(10000n);
      expect(first!.classSessionId).toBe(classSessionId);
      expect(first!.status).toBe('OPEN');

      const second = await ensureAutoChargeForClassSession(store, {
        classSessionId,
        createdByUserId: actorUserId,
      });
      expect(second!.id).toBe(first!.id);

      const viaManual = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      expect(viaManual.id).toBe(first!.id);
    });

    it('snapshots price; later Course price changes do not alter Charge', async () => {
      const charge = await ensureAutoChargeForClassSession(store, {
        classSessionId,
        createdByUserId: actorUserId,
      });
      store.setCoursePrice(courseId, 99999n, 'ARS');
      const again = await store.findChargeById(charge!.id);
      expect(again!.amountMinor).toBe(10000n);
    });

    it('skips GROUP_120 class sessions', async () => {
      const groupSessionId = randomUUID();
      store.seedClassSession({
        classSessionId: groupSessionId,
        studentId,
        groupId: randomUUID(),
        courseId: randomUUID(),
        serviceType: 'GROUP_120',
        teacherId: teacherA,
        courseAmountMinor: 50000n,
        courseCurrency: 'ARS',
        studentEnrolled: true,
      });
      const charge = await ensureAutoChargeForClassSession(store, {
        classSessionId: groupSessionId,
        createdByUserId: actorUserId,
      });
      expect(charge).toBeNull();
    });

    it('skips when Course has no list price', async () => {
      const unpricedSession = randomUUID();
      store.seedClassSession({
        classSessionId: unpricedSession,
        studentId,
        groupId: randomUUID(),
        courseId: randomUUID(),
        serviceType: 'ONE_TO_ONE_90',
        teacherId: teacherA,
        courseAmountMinor: null,
        courseCurrency: null,
        studentEnrolled: true,
      });
      const charge = await ensureAutoChargeForClassSession(store, {
        classSessionId: unpricedSession,
        createdByUserId: actorUserId,
      });
      expect(charge).toBeNull();
    });
  });

  describe('GROUP_120 Enrollment month', () => {
    it('creates a monthly Charge and is idempotent for the same period', async () => {
      const now = new Date('2026-09-15T15:00:00.000Z');
      const first = await ensureAutoChargeForEnrollmentMonth(store, {
        enrollmentId,
        createdByUserId: actorUserId,
        businessTimezone: DEFAULT_ACADEMY_TIMEZONE,
        now,
      });
      expect(first).not.toBeNull();
      expect(first!.enrollmentId).toBe(enrollmentId);
      expect(first!.amountMinor).toBe(50000n);

      const expected = calendarMonthPeriodForTimezone(
        now,
        DEFAULT_ACADEMY_TIMEZONE,
      );
      expect(first!.periodStart?.toISOString().slice(0, 10)).toBe(
        expected.periodStart.toISOString().slice(0, 10),
      );
      expect(first!.periodEnd?.toISOString().slice(0, 10)).toBe(
        expected.periodEnd.toISOString().slice(0, 10),
      );

      const second = await ensureAutoChargeForEnrollmentMonth(store, {
        enrollmentId,
        createdByUserId: actorUserId,
        businessTimezone: DEFAULT_ACADEMY_TIMEZONE,
        now,
      });
      expect(second!.id).toBe(first!.id);

      const viaManual = await createChargeForEnrollmentPeriod(store, {
        enrollmentId,
        periodStart: expected.periodStart,
        periodEnd: expected.periodEnd,
        createdByUserId: actorUserId,
      });
      expect(viaManual.id).toBe(first!.id);
    });

    it('does not create Payment automatically', async () => {
      const charge = await ensureAutoChargeForEnrollmentMonth(store, {
        enrollmentId,
        createdByUserId: actorUserId,
        businessTimezone: DEFAULT_ACADEMY_TIMEZONE,
        now: new Date('2026-09-15T15:00:00.000Z'),
      });
      const payment = await store.findPaymentByChargeId(charge!.id);
      expect(payment).toBeNull();
      expect(charge!.status).toBe('OPEN');
    });
  });

  describe('payment + freeze after auto-charge', () => {
    it('MANUAL succeed freezes allocation; settings change does not rewrite', async () => {
      await getOrCreateFinanceSettings(store);
      await updateFinanceSettings(store, {
        academyPercentage: 40,
        updatedByUserId: actorUserId,
      });

      const charge = await ensureAutoChargeForClassSession(store, {
        classSessionId,
        createdByUserId: actorUserId,
      });

      const payment = await createPayment(store, {
        chargeId: charge!.id,
        provider: 'MANUAL',
        idempotencyKey: `auto-${charge!.id}`,
        createdByUserId: actorUserId,
      });
      const result = await succeedPayment(store, payment.id);
      expect(result.payment.status).toBe('SUCCEEDED');

      const allocations = await store.listAllocations({
        paymentId: payment.id,
      });
      expect(allocations).toHaveLength(1);
      expect(allocations[0]!.academyPercentage).toBe(40);
      expect(allocations[0]!.academyAmountMinor).toBe(4000n);
      expect(allocations[0]!.teacherAmountMinor).toBe(6000n);

      await updateFinanceSettings(store, {
        academyPercentage: 50,
        updatedByUserId: actorUserId,
      });
      const frozen = await store.findAllocationById(allocations[0]!.id);
      expect(frozen!.academyPercentage).toBe(40);
      expect(frozen!.academyAmountMinor).toBe(4000n);
    });
  });
});
