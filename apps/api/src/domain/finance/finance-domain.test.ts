import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createChargeForClassSession,
  createChargeForEnrollmentPeriod,
} from './charge-service.js';
import {
  getOrCreateFinanceSettings,
  updateFinanceSettings,
} from './finance-settings-service.js';
import {
  FinanceConflictError,
  FinanceInvalidTransitionError,
  FinanceValidationError,
} from './finance-errors.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import {
  canTransitionPayment,
  createPayment,
  markPaymentCancelled,
  markPaymentFailed,
  succeedPayment,
} from './payment-service.js';
import { confirmTotalRefund } from './refund-service.js';
import {
  calculateTeacherOwed,
  createTeacherSettlement,
  markTeacherSettlementPaid,
} from './settlement-service.js';

const teacherA = randomUUID();
const teacherB = randomUUID();
const studentId = randomUUID();
const courseId = randomUUID();
const groupId = randomUUID();
const classSessionId = randomUUID();
const enrollmentId = randomUUID();
const actorUserId = randomUUID();

describe('finance domain', () => {
  const store = createInMemoryFinanceStore();

  beforeEach(() => {
    store.clear();
    store.beforeCreateAllocationHook = undefined;
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

  describe('academy percentage', () => {
    it('defaults to 40 and accepts allowed values only', async () => {
      const initial = await getOrCreateFinanceSettings(store);
      expect(initial.academyPercentage).toBe(40);
      expect(initial.teacherPercentage).toBe(60);

      for (const pct of [20, 30, 40, 50] as const) {
        const updated = await updateFinanceSettings(store, {
          academyPercentage: pct,
          updatedByUserId: actorUserId,
        });
        expect(updated.academyPercentage).toBe(pct);
        expect(updated.teacherPercentage).toBe(100 - pct);
      }

      for (const bad of [19, 25, 51, 0, 100]) {
        await expect(
          updateFinanceSettings(store, {
            academyPercentage: bad,
            updatedByUserId: actorUserId,
          }),
        ).rejects.toBeInstanceOf(FinanceValidationError);
      }
    });
  });

  describe('charge price freeze', () => {
    it('snapshots Course price and ignores later Course price changes', async () => {
      const charge = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      expect(charge.amountMinor).toBe(10000n);

      store.setCoursePrice(courseId, 99999n, 'ARS');
      const again = await store.findChargeById(charge.id);
      expect(again?.amountMinor).toBe(10000n);
    });

    it('creates GROUP charge with enrollment period', async () => {
      const charge = await createChargeForEnrollmentPeriod(store, {
        enrollmentId,
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-10-01'),
        createdByUserId: actorUserId,
      });
      expect(charge.enrollmentId).toBe(enrollmentId);
      expect(charge.classSessionId).toBeNull();
      expect(charge.amountMinor).toBe(50000n);
    });
  });

  describe('payment state machine', () => {
    it('allows only documented transitions', () => {
      expect(canTransitionPayment('PENDING', 'SUCCEEDED')).toBe(true);
      expect(canTransitionPayment('PENDING', 'FAILED')).toBe(true);
      expect(canTransitionPayment('PENDING', 'CANCELLED')).toBe(true);
      expect(canTransitionPayment('SUCCEEDED', 'REFUNDED')).toBe(true);
      expect(canTransitionPayment('SUCCEEDED', 'PENDING')).toBe(false);
      expect(canTransitionPayment('SUCCEEDED', 'FAILED')).toBe(false);
      expect(canTransitionPayment('REFUNDED', 'SUCCEEDED')).toBe(false);
      expect(canTransitionPayment('FAILED', 'SUCCEEDED')).toBe(false);
      expect(canTransitionPayment('CANCELLED', 'SUCCEEDED')).toBe(false);
    });

    it('rejects invalid transitions in domain', async () => {
      const charge = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      const payment = await createPayment(store, {
        chargeId: charge.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'pay-1',
      });
      await markPaymentFailed(store, payment.id);
      await expect(succeedPayment(store, payment.id)).rejects.toBeInstanceOf(
        FinanceInvalidTransitionError,
      );
      await expect(markPaymentCancelled(store, payment.id)).rejects.toBeInstanceOf(
        FinanceInvalidTransitionError,
      );
    });
  });

  describe('freeze on SUCCEEDED', () => {
    it('freezes academy percentage and teacherId', async () => {
      await updateFinanceSettings(store, {
        academyPercentage: 40,
        updatedByUserId: actorUserId,
      });

      const charge = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      const payment = await createPayment(store, {
        chargeId: charge.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'freeze-1',
      });
      const result = await succeedPayment(store, payment.id);

      expect(result.allocation.academyPercentage).toBe(40);
      expect(result.allocation.academyAmountMinor).toBe(4000n);
      expect(result.allocation.teacherAmountMinor).toBe(6000n);
      expect(result.allocation.teacherId).toBe(teacherA);
      expect(result.charge.status).toBe('PAID');
      expect(result.payment.status).toBe('SUCCEEDED');

      await updateFinanceSettings(store, {
        academyPercentage: 50,
        updatedByUserId: actorUserId,
      });
      store.setGroupTeacher(groupId, teacherB);

      const allocation = await store.findAllocationByPaymentAndKind(
        payment.id,
        'ORIGINAL',
      );
      expect(allocation?.academyPercentage).toBe(40);
      expect(allocation?.teacherId).toBe(teacherA);
    });
  });

  describe('atomicity', () => {
    it('rolls back payment and charge when allocation creation fails', async () => {
      const charge = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      const payment = await createPayment(store, {
        chargeId: charge.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'atomic-1',
      });

      store.beforeCreateAllocationHook = () => {
        throw new Error('simulated allocation failure');
      };

      await expect(succeedPayment(store, payment.id)).rejects.toThrow(
        'simulated allocation failure',
      );

      const paymentAfter = await store.findPaymentById(payment.id);
      const chargeAfter = await store.findChargeById(charge.id);
      const allocation = await store.findAllocationByPaymentAndKind(
        payment.id,
        'ORIGINAL',
      );
      expect(paymentAfter?.status).toBe('PENDING');
      expect(chargeAfter?.status).toBe('OPEN');
      expect(allocation).toBeNull();
    });
  });

  describe('idempotency', () => {
    it('returns existing payment for duplicate idempotency key', async () => {
      const charge = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      const first = await createPayment(store, {
        chargeId: charge.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'idem-1',
        providerPaymentId: 'prov-1',
      });
      const second = await createPayment(store, {
        chargeId: charge.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'idem-1',
      });
      expect(second.id).toBe(first.id);
    });

    it('rejects duplicate provider payment reference', async () => {
      const charge1 = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      await createPayment(store, {
        chargeId: charge1.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'idem-a',
        providerPaymentId: 'same-prov',
      });

      const classSession2 = randomUUID();
      store.seedClassSession({
        classSessionId: classSession2,
        studentId,
        groupId,
        courseId,
        serviceType: 'ONE_TO_ONE_60',
        teacherId: teacherA,
        courseAmountMinor: 10000n,
        courseCurrency: 'ARS',
        studentEnrolled: true,
      });
      const charge2 = await createChargeForClassSession(store, {
        classSessionId: classSession2,
        studentId,
        createdByUserId: actorUserId,
      });

      await expect(
        createPayment(store, {
          chargeId: charge2.id,
          provider: 'MERCADOPAGO',
          idempotencyKey: 'idem-b',
          providerPaymentId: 'same-prov',
        }),
      ).rejects.toBeInstanceOf(FinanceConflictError);
    });

    it('rejects duplicate ORIGINAL allocation via succeed twice', async () => {
      const charge = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      const payment = await createPayment(store, {
        chargeId: charge.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'dup-alloc',
      });
      await succeedPayment(store, payment.id);
      await expect(succeedPayment(store, payment.id)).rejects.toBeInstanceOf(
        FinanceInvalidTransitionError,
      );
    });
  });

  describe('refund', () => {
    it('creates REVERSAL with negative minors and keeps ORIGINAL intact', async () => {
      const charge = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      const payment = await createPayment(store, {
        chargeId: charge.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'refund-1',
      });
      await succeedPayment(store, payment.id);

      const result = await confirmTotalRefund(store, {
        paymentId: payment.id,
        reason: 'customer request',
      });

      expect(result.payment.status).toBe('REFUNDED');
      expect(result.originalAllocation.amountMinor).toBe(10000n);
      expect(result.reversalAllocation.kind).toBe('REVERSAL');
      expect(result.reversalAllocation.amountMinor).toBe(-10000n);
      expect(result.reversalAllocation.teacherAmountMinor).toBe(-6000n);
      expect(result.reversalAllocation.academyAmountMinor).toBe(-4000n);

      await expect(
        confirmTotalRefund(store, { paymentId: payment.id }),
      ).rejects.toBeInstanceOf(FinanceInvalidTransitionError);
    });
  });

  describe('settlement', () => {
    it('computes owed net of reversals and supports MARKED_PAID', async () => {
      const charge = await createChargeForClassSession(store, {
        classSessionId,
        studentId,
        createdByUserId: actorUserId,
      });
      const payment = await createPayment(store, {
        chargeId: charge.id,
        provider: 'MERCADOPAGO',
        idempotencyKey: 'settle-1',
      });
      await succeedPayment(store, payment.id);

      const periodStart = new Date('2020-01-01');
      const periodEnd = new Date('2030-01-01');

      const owedBefore = await calculateTeacherOwed(store, {
        teacherId: teacherA,
        periodStart,
        periodEnd,
        currency: 'ARS',
      });
      expect(owedBefore).toBe(6000n);

      await confirmTotalRefund(store, { paymentId: payment.id });

      const owedAfter = await calculateTeacherOwed(store, {
        teacherId: teacherA,
        periodStart,
        periodEnd,
        currency: 'ARS',
      });
      expect(owedAfter).toBe(0n);

      const settlement = await createTeacherSettlement(store, {
        teacherId: teacherA,
        periodStart,
        periodEnd,
        currency: 'ARS',
      });
      expect(settlement.totalTeacherAmountMinor).toBe(0n);
      expect(settlement.status).toBe('OPEN');

      const paid = await markTeacherSettlementPaid(store, settlement.id, 'paid');
      expect(paid.status).toBe('MARKED_PAID');
      expect(paid.markedPaidAt).not.toBeNull();
    });
  });
});
