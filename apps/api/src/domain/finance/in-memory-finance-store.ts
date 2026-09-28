import { randomUUID } from 'node:crypto';
import type {
  AcademyPercentage,
  ChargeStatus,
  CourseServiceType,
  FinanceCurrency,
  PaymentProvider,
  PaymentStatus,
  TeacherSettlementStatus,
} from '@academia/shared';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type {
  AcademyFinanceSettingsRecord,
  ChargeRecord,
  ClassSessionFinanceContext,
  EnrollmentFinanceContext,
  PaymentRecord,
  RefundRecord,
  RevenueAllocationRecord,
  TeacherSettlementRecord,
  WebhookEventRecord,
} from './finance-types.js';

interface AcademicSeed {
  classSessions: Map<
    string,
    {
      groupId: string;
      courseId: string;
      serviceType: CourseServiceType;
      teacherId: string | null;
      courseAmountMinor: bigint | null;
      courseCurrency: FinanceCurrency | null;
      enrolledStudentIds: Set<string>;
    }
  >;
  enrollments: Map<
    string,
    {
      studentId: string;
      groupId: string;
      courseId: string;
      serviceType: CourseServiceType;
      teacherId: string | null;
      courseAmountMinor: bigint | null;
      courseCurrency: FinanceCurrency | null;
    }
  >;
  /** Mutable group teacher for freeze tests. */
  groupTeachers: Map<string, string | null>;
}

export interface InMemoryFinanceStore extends FinanceStore {
  seedClassSession(context: ClassSessionFinanceContext & { studentId: string }): void;
  seedEnrollment(context: EnrollmentFinanceContext): void;
  setGroupTeacher(groupId: string, teacherId: string | null): void;
  setCoursePrice(
    courseId: string,
    amountMinor: bigint,
    currency: FinanceCurrency,
  ): void;
  clear(): void;
}

function cloneCharge(row: ChargeRecord): ChargeRecord {
  return {
    ...row,
    periodStart: row.periodStart ? new Date(row.periodStart) : null,
    periodEnd: row.periodEnd ? new Date(row.periodEnd) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function clonePayment(row: PaymentRecord): PaymentRecord {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function cloneAllocation(row: RevenueAllocationRecord): RevenueAllocationRecord {
  return { ...row, createdAt: new Date(row.createdAt) };
}

export function createInMemoryFinanceStore(): InMemoryFinanceStore {
  let settings: AcademyFinanceSettingsRecord | null = null;
  const charges = new Map<string, ChargeRecord>();
  const payments = new Map<string, PaymentRecord>();
  const allocations = new Map<string, RevenueAllocationRecord>();
  const refunds = new Map<string, RefundRecord>();
  const settlements = new Map<string, TeacherSettlementRecord>();
  const webhooks = new Map<string, WebhookEventRecord>();
  const academic: AcademicSeed = {
    classSessions: new Map(),
    enrollments: new Map(),
    groupTeachers: new Map(),
  };
  const coursePrices = new Map<
    string,
    { amountMinor: bigint; currency: FinanceCurrency }
  >();

  let depth = 0;
  let snapshot: {
    settings: AcademyFinanceSettingsRecord | null;
    charges: Map<string, ChargeRecord>;
    payments: Map<string, PaymentRecord>;
    allocations: Map<string, RevenueAllocationRecord>;
    refunds: Map<string, RefundRecord>;
    settlements: Map<string, TeacherSettlementRecord>;
  } | null = null;

  const store: InMemoryFinanceStore = {
    beforeCreateAllocationHook: undefined,

    clear() {
      settings = null;
      charges.clear();
      payments.clear();
      allocations.clear();
      refunds.clear();
      settlements.clear();
      webhooks.clear();
      academic.classSessions.clear();
      academic.enrollments.clear();
      academic.groupTeachers.clear();
      coursePrices.clear();
    },

    seedClassSession(context) {
      academic.classSessions.set(context.classSessionId, {
        groupId: context.groupId,
        courseId: context.courseId,
        serviceType: context.serviceType,
        teacherId: context.teacherId,
        courseAmountMinor: context.courseAmountMinor,
        courseCurrency: context.courseCurrency,
        enrolledStudentIds: new Set(
          context.studentEnrolled ? [context.studentId] : [],
        ),
      });
      academic.groupTeachers.set(context.groupId, context.teacherId);
      if (context.courseAmountMinor !== null && context.courseCurrency) {
        coursePrices.set(context.courseId, {
          amountMinor: context.courseAmountMinor,
          currency: context.courseCurrency,
        });
      }
    },

    seedEnrollment(context) {
      academic.enrollments.set(context.enrollmentId, { ...context });
      academic.groupTeachers.set(context.groupId, context.teacherId);
      if (context.courseAmountMinor !== null && context.courseCurrency) {
        coursePrices.set(context.courseId, {
          amountMinor: context.courseAmountMinor,
          currency: context.courseCurrency,
        });
      }
    },

    setGroupTeacher(groupId, teacherId) {
      academic.groupTeachers.set(groupId, teacherId);
      for (const session of academic.classSessions.values()) {
        if (session.groupId === groupId) session.teacherId = teacherId;
      }
      for (const enrollment of academic.enrollments.values()) {
        if (enrollment.groupId === groupId) enrollment.teacherId = teacherId;
      }
    },

    setCoursePrice(courseId, amountMinor, currency) {
      coursePrices.set(courseId, { amountMinor, currency });
      for (const session of academic.classSessions.values()) {
        if (session.courseId === courseId) {
          session.courseAmountMinor = amountMinor;
          session.courseCurrency = currency;
        }
      }
      for (const enrollment of academic.enrollments.values()) {
        if (enrollment.courseId === courseId) {
          enrollment.courseAmountMinor = amountMinor;
          enrollment.courseCurrency = currency;
        }
      }
    },

    async runInTransaction(fn) {
      if (depth === 0) {
        snapshot = {
          settings: settings
            ? { ...settings, updatedAt: new Date(settings.updatedAt) }
            : null,
          charges: new Map(
            [...charges.entries()].map(([k, v]) => [k, cloneCharge(v)]),
          ),
          payments: new Map(
            [...payments.entries()].map(([k, v]) => [k, clonePayment(v)]),
          ),
          allocations: new Map(
            [...allocations.entries()].map(([k, v]) => [k, cloneAllocation(v)]),
          ),
          refunds: new Map(
            [...refunds.entries()].map(([k, v]) => [
              k,
              { ...v, createdAt: new Date(v.createdAt) },
            ]),
          ),
          settlements: new Map(
            [...settlements.entries()].map(([k, v]) => [
              k,
              {
                ...v,
                periodStart: new Date(v.periodStart),
                periodEnd: new Date(v.periodEnd),
                markedPaidAt: v.markedPaidAt ? new Date(v.markedPaidAt) : null,
                createdAt: new Date(v.createdAt),
                updatedAt: new Date(v.updatedAt),
              },
            ]),
          ),
        };
      }
      depth += 1;
      try {
        const result = await fn(store);
        depth -= 1;
        if (depth === 0) snapshot = null;
        return result;
      } catch (error) {
        depth -= 1;
        if (depth === 0 && snapshot) {
          settings = snapshot.settings;
          charges.clear();
          for (const [k, v] of snapshot.charges) charges.set(k, v);
          payments.clear();
          for (const [k, v] of snapshot.payments) payments.set(k, v);
          allocations.clear();
          for (const [k, v] of snapshot.allocations) allocations.set(k, v);
          refunds.clear();
          for (const [k, v] of snapshot.refunds) refunds.set(k, v);
          settlements.clear();
          for (const [k, v] of snapshot.settlements) settlements.set(k, v);
          snapshot = null;
        }
        throw error;
      }
    },

    async getFinanceSettings() {
      return settings
        ? { ...settings, updatedAt: new Date(settings.updatedAt) }
        : null;
    },

    async upsertFinanceSettings(input) {
      const now = new Date();
      if (settings) {
        settings = {
          ...settings,
          academyPercentage: input.academyPercentage,
          updatedByUserId: input.updatedByUserId,
          updatedAt: now,
        };
      } else {
        settings = {
          id: randomUUID(),
          academyPercentage: input.academyPercentage,
          updatedByUserId: input.updatedByUserId,
          updatedAt: now,
        };
      }
      return { ...settings, updatedAt: new Date(settings.updatedAt) };
    },

    async findChargeById(id) {
      const row = charges.get(id);
      return row ? cloneCharge(row) : null;
    },

    async findChargeByClassSessionId(classSessionId) {
      for (const row of charges.values()) {
        if (row.classSessionId === classSessionId) return cloneCharge(row);
      }
      return null;
    },

    async findChargeByEnrollmentPeriod(input) {
      const startKey = input.periodStart.toISOString().slice(0, 10);
      const endKey = input.periodEnd.toISOString().slice(0, 10);
      for (const row of charges.values()) {
        if (row.enrollmentId !== input.enrollmentId) continue;
        if (!row.periodStart || !row.periodEnd) continue;
        if (
          row.periodStart.toISOString().slice(0, 10) === startKey &&
          row.periodEnd.toISOString().slice(0, 10) === endKey
        ) {
          return cloneCharge(row);
        }
      }
      return null;
    },

    async listActiveEnrollmentsForClassSession(classSessionId) {
      const session = academic.classSessions.get(classSessionId);
      if (!session) return [];
      return [...session.enrolledStudentIds]
        .sort((a, b) => a.localeCompare(b))
        .map((studentId) => {
          const enrollment = [...academic.enrollments.entries()].find(
            ([, row]) =>
              row.groupId === session.groupId && row.studentId === studentId,
          );
          return {
            enrollmentId: enrollment?.[0] ?? studentId,
            studentId,
            serviceType: session.serviceType,
          };
        });
    },

    async listCharges(filters) {
      return [...charges.values()]
        .filter((row) => {
          if (filters.studentId && row.studentId !== filters.studentId) {
            return false;
          }
          if (filters.courseId && row.courseId !== filters.courseId) {
            return false;
          }
          if (
            filters.classSessionId &&
            row.classSessionId !== filters.classSessionId
          ) {
            return false;
          }
          if (filters.status && row.status !== filters.status) return false;
          if (filters.currency && row.currency !== filters.currency) {
            return false;
          }
          if (filters.teacherId) {
            if (!row.groupId) return false;
            if (academic.groupTeachers.get(row.groupId) !== filters.teacherId) {
              return false;
            }
          }
          return true;
        })
        .map(cloneCharge)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async createCharge(input) {
      if (input.classSessionId) {
        for (const row of charges.values()) {
          if (row.classSessionId === input.classSessionId) {
            throw new FinanceConflictError('Charge unique constraint violated.');
          }
        }
      }
      if (input.enrollmentId && input.periodStart && input.periodEnd) {
        const startKey = input.periodStart.toISOString().slice(0, 10);
        const endKey = input.periodEnd.toISOString().slice(0, 10);
        for (const row of charges.values()) {
          if (row.enrollmentId !== input.enrollmentId) continue;
          if (!row.periodStart || !row.periodEnd) continue;
          if (
            row.periodStart.toISOString().slice(0, 10) === startKey &&
            row.periodEnd.toISOString().slice(0, 10) === endKey
          ) {
            throw new FinanceConflictError('Charge unique constraint violated.');
          }
        }
      }

      const now = new Date();
      const row: ChargeRecord = {
        id: randomUUID(),
        studentId: input.studentId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: 'OPEN',
        courseId: input.courseId,
        groupId: input.groupId,
        enrollmentId: input.enrollmentId,
        classSessionId: input.classSessionId,
        description: input.description,
        createdByUserId: input.createdByUserId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        createdAt: now,
        updatedAt: now,
      };
      charges.set(row.id, row);
      return cloneCharge(row);
    },

    async updateChargeStatus(id, status: ChargeStatus) {
      const current = charges.get(id);
      if (!current) throw new FinanceNotFoundError('Charge not found.');
      const next = { ...current, status, updatedAt: new Date() };
      charges.set(id, next);
      return cloneCharge(next);
    },

    async findPaymentById(id) {
      const row = payments.get(id);
      return row ? clonePayment(row) : null;
    },

    async listPayments(filters) {
      return [...payments.values()]
        .filter((row) => {
          if (filters.studentId && row.studentId !== filters.studentId) {
            return false;
          }
          if (filters.chargeId && row.chargeId !== filters.chargeId) {
            return false;
          }
          if (filters.status && row.status !== filters.status) return false;
          if (filters.currency && row.currency !== filters.currency) {
            return false;
          }
          if (filters.provider && row.provider !== filters.provider) {
            return false;
          }
          if (filters.teacherId) {
            const charge = charges.get(row.chargeId);
            if (!charge?.groupId) return false;
            if (
              academic.groupTeachers.get(charge.groupId) !== filters.teacherId
            ) {
              return false;
            }
          }
          return true;
        })
        .map(clonePayment)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async findPaymentByIdempotencyKey(key) {
      for (const row of payments.values()) {
        if (row.idempotencyKey === key) return clonePayment(row);
      }
      return null;
    },

    async findPaymentByProviderReference(provider, providerPaymentId) {
      for (const row of payments.values()) {
        if (
          row.provider === provider &&
          row.providerPaymentId === providerPaymentId
        ) {
          return clonePayment(row);
        }
      }
      return null;
    },

    async findPaymentByChargeId(chargeId) {
      for (const row of payments.values()) {
        if (row.chargeId === chargeId) return clonePayment(row);
      }
      return null;
    },

    async createPayment(input) {
      for (const row of payments.values()) {
        if (row.idempotencyKey === input.idempotencyKey) {
          throw new FinanceConflictError('Payment unique constraint violated.');
        }
        if (row.chargeId === input.chargeId) {
          throw new FinanceConflictError('Payment unique constraint violated.');
        }
        if (
          input.providerPaymentId &&
          row.provider === input.provider &&
          row.providerPaymentId === input.providerPaymentId
        ) {
          throw new FinanceConflictError('Payment unique constraint violated.');
        }
      }
      const now = new Date();
      const row: PaymentRecord = {
        id: randomUUID(),
        studentId: input.studentId,
        chargeId: input.chargeId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: 'PENDING',
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        idempotencyKey: input.idempotencyKey,
        createdByUserId: input.createdByUserId,
        createdAt: now,
        updatedAt: now,
      };
      payments.set(row.id, row);
      return clonePayment(row);
    },

    async updatePaymentStatus(id, status: PaymentStatus) {
      const current = payments.get(id);
      if (!current) throw new FinanceNotFoundError('Payment not found.');
      const next = { ...current, status, updatedAt: new Date() };
      payments.set(id, next);
      return clonePayment(next);
    },

    async findAllocationByPaymentAndKind(paymentId, kind) {
      for (const row of allocations.values()) {
        if (row.paymentId === paymentId && row.kind === kind) {
          return cloneAllocation(row);
        }
      }
      return null;
    },

    async findAllocationById(id) {
      const row = allocations.get(id);
      return row ? cloneAllocation(row) : null;
    },

    async listAllocations(filters) {
      return [...allocations.values()]
        .filter((row) => {
          if (filters.studentId && row.studentId !== filters.studentId) {
            return false;
          }
          if (filters.teacherId && row.teacherId !== filters.teacherId) {
            return false;
          }
          if (filters.paymentId && row.paymentId !== filters.paymentId) {
            return false;
          }
          if (filters.chargeId && row.chargeId !== filters.chargeId) {
            return false;
          }
          if (filters.kind && row.kind !== filters.kind) return false;
          if (filters.currency && row.currency !== filters.currency) {
            return false;
          }
          return true;
        })
        .map(cloneAllocation)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async createAllocation(input) {
      for (const row of allocations.values()) {
        if (row.paymentId === input.paymentId && row.kind === input.kind) {
          throw new FinanceConflictError(
            'RevenueAllocation unique constraint violated.',
          );
        }
      }
      const row: RevenueAllocationRecord = {
        id: randomUUID(),
        paymentId: input.paymentId,
        chargeId: input.chargeId,
        studentId: input.studentId,
        teacherId: input.teacherId,
        courseId: input.courseId,
        groupId: input.groupId,
        kind: input.kind,
        amountMinor: input.amountMinor,
        currency: input.currency,
        academyPercentage: input.academyPercentage as AcademyPercentage,
        academyAmountMinor: input.academyAmountMinor,
        teacherAmountMinor: input.teacherAmountMinor,
        refundId: input.refundId,
        createdAt: new Date(),
      };
      allocations.set(row.id, row);
      return cloneAllocation(row);
    },

    async listAllocationsForTeacherPeriod(input) {
      return [...allocations.values()]
        .filter((row) => {
          if (row.teacherId !== input.teacherId) return false;
          if (row.createdAt < input.periodStart) return false;
          if (!(row.createdAt < input.periodEnd)) return false;
          if (input.currency && row.currency !== input.currency) return false;
          return true;
        })
        .map(cloneAllocation)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },

    async findRefundByPaymentId(paymentId) {
      for (const row of refunds.values()) {
        if (row.paymentId === paymentId) {
          return { ...row, createdAt: new Date(row.createdAt) };
        }
      }
      return null;
    },

    async createRefund(input) {
      for (const row of refunds.values()) {
        if (row.paymentId === input.paymentId) {
          throw new FinanceConflictError('Refund already exists.');
        }
      }
      const row: RefundRecord = {
        id: randomUUID(),
        paymentId: input.paymentId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        reason: input.reason,
        createdByUserId: input.createdByUserId,
        createdAt: new Date(),
      };
      refunds.set(row.id, row);
      return { ...row, createdAt: new Date(row.createdAt) };
    },

    async findSettlementById(id) {
      const row = settlements.get(id);
      return row
        ? {
            ...row,
            periodStart: new Date(row.periodStart),
            periodEnd: new Date(row.periodEnd),
            markedPaidAt: row.markedPaidAt ? new Date(row.markedPaidAt) : null,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
          }
        : null;
    },

    async listSettlements(filters) {
      return [...settlements.values()]
        .filter((row) => {
          if (filters.teacherId && row.teacherId !== filters.teacherId) {
            return false;
          }
          if (filters.status && row.status !== filters.status) return false;
          if (filters.currency && row.currency !== filters.currency) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((row) => ({
          ...row,
          periodStart: new Date(row.periodStart),
          periodEnd: new Date(row.periodEnd),
          markedPaidAt: row.markedPaidAt ? new Date(row.markedPaidAt) : null,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        }));
    },

    async findSettlementByKey(input) {
      for (const row of settlements.values()) {
        if (
          row.teacherId === input.teacherId &&
          row.periodStart.getTime() === input.periodStart.getTime() &&
          row.periodEnd.getTime() === input.periodEnd.getTime() &&
          row.currency === input.currency
        ) {
          return store.findSettlementById(row.id);
        }
      }
      return null;
    },

    async createSettlement(input) {
      const now = new Date();
      const row: TeacherSettlementRecord = {
        id: randomUUID(),
        teacherId: input.teacherId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalTeacherAmountMinor: input.totalTeacherAmountMinor,
        currency: input.currency,
        status: 'OPEN',
        markedPaidAt: null,
        note: input.note,
        createdAt: now,
        updatedAt: now,
      };
      settlements.set(row.id, row);
      return (await store.findSettlementById(row.id))!;
    },

    async markSettlementPaid(id, note) {
      const current = settlements.get(id);
      if (!current) throw new FinanceNotFoundError('TeacherSettlement not found.');
      if (current.status === 'MARKED_PAID') {
        throw new FinanceConflictError('TeacherSettlement is already MARKED_PAID.');
      }
      const next: TeacherSettlementRecord = {
        ...current,
        status: 'MARKED_PAID' as TeacherSettlementStatus,
        markedPaidAt: new Date(),
        note: note ?? current.note,
        updatedAt: new Date(),
      };
      settlements.set(id, next);
      return (await store.findSettlementById(id))!;
    },

    async createWebhookEvent(input) {
      for (const row of webhooks.values()) {
        if (
          row.provider === input.provider &&
          row.providerEventId === input.providerEventId
        ) {
          throw new FinanceConflictError(
            'WebhookEvent already recorded for this provider event.',
          );
        }
      }
      const row: WebhookEventRecord = {
        id: randomUUID(),
        provider: input.provider as PaymentProvider,
        providerEventId: input.providerEventId,
        payload: input.payload,
        processedAt: null,
        error: null,
        createdAt: new Date(),
      };
      webhooks.set(row.id, row);
      return { ...row, createdAt: new Date(row.createdAt) };
    },

    async findWebhookEvent(provider, providerEventId) {
      for (const row of webhooks.values()) {
        if (
          row.provider === provider &&
          row.providerEventId === providerEventId
        ) {
          return {
            ...row,
            processedAt: row.processedAt ? new Date(row.processedAt) : null,
            createdAt: new Date(row.createdAt),
          };
        }
      }
      return null;
    },

    async markWebhookProcessed(id, input) {
      const current = webhooks.get(id);
      if (!current) {
        throw new FinanceNotFoundError('WebhookEvent not found.');
      }
      const next: WebhookEventRecord = {
        ...current,
        processedAt: new Date(),
        error: input.error,
      };
      webhooks.set(id, next);
      return {
        ...next,
        processedAt: next.processedAt ? new Date(next.processedAt) : null,
        createdAt: new Date(next.createdAt),
      };
    },

    async loadClassSessionFinanceContext(input) {
      const session = academic.classSessions.get(input.classSessionId);
      if (!session) return null;
      const price = coursePrices.get(session.courseId);
      return {
        classSessionId: input.classSessionId,
        groupId: session.groupId,
        courseId: session.courseId,
        serviceType: session.serviceType,
        teacherId: academic.groupTeachers.get(session.groupId) ?? session.teacherId,
        courseAmountMinor: price?.amountMinor ?? session.courseAmountMinor,
        courseCurrency: price?.currency ?? session.courseCurrency,
        studentEnrolled: session.enrolledStudentIds.has(input.studentId),
      };
    },

    async loadEnrollmentFinanceContext(enrollmentId) {
      const enrollment = academic.enrollments.get(enrollmentId);
      if (!enrollment) return null;
      const price = coursePrices.get(enrollment.courseId);
      return {
        enrollmentId,
        studentId: enrollment.studentId,
        groupId: enrollment.groupId,
        courseId: enrollment.courseId,
        serviceType: enrollment.serviceType,
        teacherId:
          academic.groupTeachers.get(enrollment.groupId) ?? enrollment.teacherId,
        courseAmountMinor: price?.amountMinor ?? enrollment.courseAmountMinor,
        courseCurrency: price?.currency ?? enrollment.courseCurrency,
      };
    },

    async resolveTeacherIdForCharge(charge) {
      if (charge.classSessionId) {
        const session = academic.classSessions.get(charge.classSessionId);
        if (!session) return null;
        return academic.groupTeachers.get(session.groupId) ?? session.teacherId;
      }
      if (charge.enrollmentId) {
        const enrollment = academic.enrollments.get(charge.enrollmentId);
        if (!enrollment) return null;
        return (
          academic.groupTeachers.get(enrollment.groupId) ?? enrollment.teacherId
        );
      }
      throw new FinanceValidationError(
        'Charge has no commercial context for teacher resolution.',
      );
    },
  };

  return store;
}
