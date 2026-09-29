import type {
  ChargeStatus,
  CourseServiceType,
  FinanceCurrency,
  PaymentProvider,
  PaymentStatus,
  RevenueAllocationKind,
  TeacherSettlementStatus,
} from '@academia/shared';
import {
  isAcademyPercentage,
  isCourseServiceType,
  isFinanceCurrency,
} from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import type { FinanceStore } from './finance-store.js';
import type {
  AcademyFinanceSettingsRecord,
  ChargeRecord,
  PaymentRecord,
  RefundRecord,
  RevenueAllocationRecord,
  TeacherSettlementRecord,
  WebhookEventRecord,
} from './finance-types.js';

type TxClient = Parameters<Parameters<Database['$transaction']>[0]>[0];
type FinanceDb = Database | TxClient;

function mapSettings(row: {
  id: string;
  academyPercentage: number;
  updatedAt: Date;
  updatedByUserId: string | null;
}): AcademyFinanceSettingsRecord {
  if (!isAcademyPercentage(row.academyPercentage)) {
    throw new Error(
      `Invalid academyPercentage in database: ${row.academyPercentage}`,
    );
  }
  return {
    id: row.id,
    academyPercentage: row.academyPercentage,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

function mapCharge(row: {
  id: string;
  studentId: string;
  amountMinor: bigint;
  currency: string;
  status: string;
  courseId: string | null;
  groupId: string | null;
  enrollmentId: string | null;
  classSessionId: string | null;
  description: string | null;
  createdByUserId: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ChargeRecord {
  if (!isFinanceCurrency(row.currency)) {
    throw new Error(`Invalid charge currency: ${row.currency}`);
  }
  return {
    id: row.id,
    studentId: row.studentId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status as ChargeStatus,
    courseId: row.courseId,
    groupId: row.groupId,
    enrollmentId: row.enrollmentId,
    classSessionId: row.classSessionId,
    description: row.description,
    createdByUserId: row.createdByUserId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPayment(row: {
  id: string;
  studentId: string;
  chargeId: string;
  amountMinor: bigint;
  currency: string;
  status: string;
  provider: string;
  providerPaymentId: string | null;
  idempotencyKey: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentRecord {
  if (!isFinanceCurrency(row.currency)) {
    throw new Error(`Invalid payment currency: ${row.currency}`);
  }
  return {
    id: row.id,
    studentId: row.studentId,
    chargeId: row.chargeId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status as PaymentStatus,
    provider: row.provider as PaymentProvider,
    providerPaymentId: row.providerPaymentId,
    idempotencyKey: row.idempotencyKey,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAllocation(row: {
  id: string;
  paymentId: string;
  chargeId: string;
  studentId: string;
  teacherId: string;
  courseId: string | null;
  groupId: string | null;
  kind: string;
  amountMinor: bigint;
  currency: string;
  academyPercentage: number;
  academyAmountMinor: bigint;
  teacherAmountMinor: bigint;
  refundId: string | null;
  createdAt: Date;
}): RevenueAllocationRecord {
  if (!isFinanceCurrency(row.currency)) {
    throw new Error(`Invalid allocation currency: ${row.currency}`);
  }
  if (!isAcademyPercentage(row.academyPercentage)) {
    throw new Error(`Invalid allocation academyPercentage: ${row.academyPercentage}`);
  }
  return {
    id: row.id,
    paymentId: row.paymentId,
    chargeId: row.chargeId,
    studentId: row.studentId,
    teacherId: row.teacherId,
    courseId: row.courseId,
    groupId: row.groupId,
    kind: row.kind as RevenueAllocationKind,
    amountMinor: row.amountMinor,
    currency: row.currency,
    academyPercentage: row.academyPercentage,
    academyAmountMinor: row.academyAmountMinor,
    teacherAmountMinor: row.teacherAmountMinor,
    refundId: row.refundId,
    createdAt: row.createdAt,
  };
}

function mapRefund(row: {
  id: string;
  paymentId: string;
  amountMinor: bigint;
  currency: string;
  reason: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}): RefundRecord {
  if (!isFinanceCurrency(row.currency)) {
    throw new Error(`Invalid refund currency: ${row.currency}`);
  }
  return {
    id: row.id,
    paymentId: row.paymentId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    reason: row.reason,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

function mapSettlement(row: {
  id: string;
  teacherId: string;
  periodStart: Date;
  periodEnd: Date;
  totalTeacherAmountMinor: bigint;
  currency: string;
  status: string;
  markedPaidAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TeacherSettlementRecord {
  if (!isFinanceCurrency(row.currency)) {
    throw new Error(`Invalid settlement currency: ${row.currency}`);
  }
  return {
    id: row.id,
    teacherId: row.teacherId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    totalTeacherAmountMinor: row.totalTeacherAmountMinor,
    currency: row.currency,
    status: row.status as TeacherSettlementStatus,
    markedPaidAt: row.markedPaidAt,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapWebhook(row: {
  id: string;
  provider: string;
  providerEventId: string;
  payload: unknown;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}): WebhookEventRecord {
  return {
    id: row.id,
    provider: row.provider as PaymentProvider,
    providerEventId: row.providerEventId,
    payload: row.payload,
    processedAt: row.processedAt,
    error: row.error,
    createdAt: row.createdAt,
  };
}

function createFinanceStoreForDb(
  db: FinanceDb,
  root: Database,
  hooks: { beforeCreateAllocationHook?: () => void | Promise<void> },
): FinanceStore {
  const store: FinanceStore = {
    beforeCreateAllocationHook: hooks.beforeCreateAllocationHook,

    async runInTransaction(fn) {
      return root.$transaction(async (tx) =>
        fn(createFinanceStoreForDb(tx, root, hooks)),
      );
    },

    async getFinanceSettings() {
      const row = await db.academyFinanceSettings.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
      return row ? mapSettings(row) : null;
    },

    async upsertFinanceSettings(input) {
      const existing = await db.academyFinanceSettings.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
      if (existing) {
        const row = await db.academyFinanceSettings.update({
          where: { id: existing.id },
          data: {
            academyPercentage: input.academyPercentage,
            updatedByUserId: input.updatedByUserId,
          },
        });
        return mapSettings(row);
      }
      const row = await db.academyFinanceSettings.create({
        data: {
          academyPercentage: input.academyPercentage,
          updatedByUserId: input.updatedByUserId,
        },
      });
      return mapSettings(row);
    },

    async findChargeById(id) {
      const row = await db.charge.findUnique({ where: { id } });
      return row ? mapCharge(row) : null;
    },

    async findChargeByClassSessionId(classSessionId) {
      const row = await db.charge.findFirst({
        where: { classSessionId },
      });
      return row ? mapCharge(row) : null;
    },

    async findChargeByEnrollmentPeriod(input) {
      const row = await db.charge.findFirst({
        where: {
          enrollmentId: input.enrollmentId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
      });
      return row ? mapCharge(row) : null;
    },

    async listActiveEnrollmentsForClassSession(classSessionId) {
      const session = await db.classSession.findUnique({
        where: { id: classSessionId },
        select: {
          group: {
            select: {
              course: { select: { serviceType: true } },
              enrollments: {
                where: { isActive: true },
                select: { id: true, studentId: true },
                orderBy: { studentId: 'asc' },
              },
            },
          },
        },
      });
      if (!session) return [];
      const serviceType = session.group.course.serviceType;
      if (!isCourseServiceType(serviceType)) {
        throw new Error(`Invalid course serviceType: ${serviceType}`);
      }
      return session.group.enrollments.map((row) => ({
        enrollmentId: row.id,
        studentId: row.studentId,
        serviceType: serviceType as CourseServiceType,
      }));
    },

    async listCharges(filters) {
      const rows = await db.charge.findMany({
        where: {
          ...(filters.studentId ? { studentId: filters.studentId } : {}),
          ...(filters.courseId ? { courseId: filters.courseId } : {}),
          ...(filters.classSessionId
            ? { classSessionId: filters.classSessionId }
            : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.currency ? { currency: filters.currency } : {}),
          ...(filters.teacherId
            ? { group: { teacherId: filters.teacherId } }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapCharge);
    },

    async createCharge(input) {
      try {
        const row = await db.charge.create({
          data: {
            studentId: input.studentId,
            amountMinor: input.amountMinor,
            currency: input.currency,
            courseId: input.courseId,
            groupId: input.groupId,
            enrollmentId: input.enrollmentId,
            classSessionId: input.classSessionId,
            description: input.description,
            createdByUserId: input.createdByUserId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          },
        });
        return mapCharge(row);
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        if (code === 'P2002') {
          throw new FinanceConflictError('Charge unique constraint violated.');
        }
        throw error;
      }
    },

    async updateChargeStatus(id, status) {
      const row = await db.charge.update({
        where: { id },
        data: { status },
      });
      return mapCharge(row);
    },

    async findPaymentById(id) {
      const row = await db.payment.findUnique({ where: { id } });
      return row ? mapPayment(row) : null;
    },

    async listPayments(filters) {
      const rows = await db.payment.findMany({
        where: {
          ...(filters.studentId ? { studentId: filters.studentId } : {}),
          ...(filters.chargeId ? { chargeId: filters.chargeId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.currency ? { currency: filters.currency } : {}),
          ...(filters.provider ? { provider: filters.provider } : {}),
          ...(filters.teacherId
            ? { charge: { group: { teacherId: filters.teacherId } } }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapPayment);
    },

    async findPaymentByIdempotencyKey(key) {
      const row = await db.payment.findUnique({
        where: { idempotencyKey: key },
      });
      return row ? mapPayment(row) : null;
    },

    async findPaymentByProviderReference(provider, providerPaymentId) {
      const row = await db.payment.findFirst({
        where: { provider, providerPaymentId },
      });
      return row ? mapPayment(row) : null;
    },

    async findPaymentByChargeId(chargeId) {
      const row = await db.payment.findUnique({ where: { chargeId } });
      return row ? mapPayment(row) : null;
    },

    async createPayment(input) {
      try {
        const row = await db.payment.create({
          data: {
            studentId: input.studentId,
            chargeId: input.chargeId,
            amountMinor: input.amountMinor,
            currency: input.currency,
            provider: input.provider,
            providerPaymentId: input.providerPaymentId,
            idempotencyKey: input.idempotencyKey,
            createdByUserId: input.createdByUserId,
          },
        });
        return mapPayment(row);
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        if (code === 'P2002') {
          throw new FinanceConflictError('Payment unique constraint violated.');
        }
        throw error;
      }
    },

    async updatePaymentStatus(id, status) {
      const row = await db.payment.update({
        where: { id },
        data: { status },
      });
      return mapPayment(row);
    },

    async findAllocationByPaymentAndKind(paymentId, kind) {
      const row = await db.revenueAllocation.findUnique({
        where: { paymentId_kind: { paymentId, kind } },
      });
      return row ? mapAllocation(row) : null;
    },

    async findAllocationById(id) {
      const row = await db.revenueAllocation.findUnique({ where: { id } });
      return row ? mapAllocation(row) : null;
    },

    async listAllocations(filters) {
      const rows = await db.revenueAllocation.findMany({
        where: {
          ...(filters.studentId ? { studentId: filters.studentId } : {}),
          ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
          ...(filters.paymentId ? { paymentId: filters.paymentId } : {}),
          ...(filters.chargeId ? { chargeId: filters.chargeId } : {}),
          ...(filters.kind ? { kind: filters.kind } : {}),
          ...(filters.currency ? { currency: filters.currency } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapAllocation);
    },

    async createAllocation(input) {
      try {
        const row = await db.revenueAllocation.create({
          data: {
            paymentId: input.paymentId,
            chargeId: input.chargeId,
            studentId: input.studentId,
            teacherId: input.teacherId,
            courseId: input.courseId,
            groupId: input.groupId,
            kind: input.kind,
            amountMinor: input.amountMinor,
            currency: input.currency,
            academyPercentage: input.academyPercentage,
            academyAmountMinor: input.academyAmountMinor,
            teacherAmountMinor: input.teacherAmountMinor,
            refundId: input.refundId,
          },
        });
        return mapAllocation(row);
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        if (code === 'P2002') {
          throw new FinanceConflictError(
            'RevenueAllocation unique constraint violated.',
          );
        }
        throw error;
      }
    },

    async listAllocationsForTeacherPeriod(input) {
      const rows = await db.revenueAllocation.findMany({
        where: {
          teacherId: input.teacherId,
          createdAt: {
            gte: input.periodStart,
            lt: input.periodEnd,
          },
          ...(input.currency ? { currency: input.currency } : {}),
        },
        orderBy: [{ createdAt: 'asc' }],
      });
      return rows.map(mapAllocation);
    },

    async findRefundByPaymentId(paymentId) {
      const row = await db.refund.findUnique({ where: { paymentId } });
      return row ? mapRefund(row) : null;
    },

    async createRefund(input) {
      const row = await db.refund.create({
        data: {
          paymentId: input.paymentId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          reason: input.reason,
          createdByUserId: input.createdByUserId,
        },
      });
      return mapRefund(row);
    },

    async findSettlementById(id) {
      const row = await db.teacherSettlement.findUnique({ where: { id } });
      return row ? mapSettlement(row) : null;
    },

    async listSettlements(filters) {
      const rows = await db.teacherSettlement.findMany({
        where: {
          ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.currency ? { currency: filters.currency } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapSettlement);
    },

    async findSettlementByKey(input) {
      const row = await db.teacherSettlement.findUnique({
        where: {
          teacherId_periodStart_periodEnd_currency: {
            teacherId: input.teacherId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            currency: input.currency,
          },
        },
      });
      return row ? mapSettlement(row) : null;
    },

    async createSettlement(input) {
      const row = await db.teacherSettlement.create({
        data: {
          teacherId: input.teacherId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalTeacherAmountMinor: input.totalTeacherAmountMinor,
          currency: input.currency,
          note: input.note,
        },
      });
      return mapSettlement(row);
    },

    async markSettlementPaid(id, note) {
      const existing = await db.teacherSettlement.findUnique({ where: { id } });
      if (!existing) {
        throw new FinanceNotFoundError('TeacherSettlement not found.');
      }
      if (existing.status === 'MARKED_PAID') {
        throw new FinanceConflictError('TeacherSettlement is already MARKED_PAID.');
      }
      const row = await db.teacherSettlement.update({
        where: { id },
        data: {
          status: 'MARKED_PAID',
          markedPaidAt: new Date(),
          note: note ?? existing.note,
        },
      });
      return mapSettlement(row);
    },

    async createWebhookEvent(input) {
      try {
        const row = await db.webhookEvent.create({
          data: {
            provider: input.provider,
            providerEventId: input.providerEventId,
            payload: input.payload as object,
          },
        });
        return mapWebhook(row);
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        if (code === 'P2002') {
          throw new FinanceConflictError(
            'WebhookEvent already recorded for this provider event.',
          );
        }
        throw error;
      }
    },

    async findWebhookEvent(provider, providerEventId) {
      const row = await db.webhookEvent.findUnique({
        where: {
          provider_providerEventId: { provider, providerEventId },
        },
      });
      return row ? mapWebhook(row) : null;
    },

    async markWebhookProcessed(id, input) {
      const row = await db.webhookEvent.update({
        where: { id },
        data: {
          processedAt: new Date(),
          error: input.error,
        },
      });
      return mapWebhook(row);
    },

    async loadClassSessionFinanceContext(input) {
      const session = await db.classSession.findUnique({
        where: { id: input.classSessionId },
        include: {
          group: {
            include: {
              course: true,
              enrollments: {
                where: { studentId: input.studentId, isActive: true },
                take: 1,
              },
            },
          },
        },
      });
      if (!session) return null;
      const serviceType = session.group.course.serviceType;
      if (!isCourseServiceType(serviceType)) {
        throw new Error(`Invalid course serviceType: ${serviceType}`);
      }
      let courseCurrency: FinanceCurrency | null = null;
      if (session.group.course.currency !== null) {
        if (!isFinanceCurrency(session.group.course.currency)) {
          throw new Error('Invalid course currency');
        }
        courseCurrency = session.group.course.currency;
      }
      return {
        classSessionId: session.id,
        groupId: session.groupId,
        courseId: session.group.courseId,
        serviceType: serviceType as CourseServiceType,
        teacherId: session.group.teacherId,
        courseAmountMinor: session.group.course.amountMinor,
        courseCurrency,
        studentEnrolled: session.group.enrollments.length > 0,
      };
    },

    async loadEnrollmentFinanceContext(enrollmentId) {
      const enrollment = await db.enrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          group: { include: { course: true } },
        },
      });
      if (!enrollment) return null;
      const serviceType = enrollment.group.course.serviceType;
      if (!isCourseServiceType(serviceType)) {
        throw new Error(`Invalid course serviceType: ${serviceType}`);
      }
      let courseCurrency: FinanceCurrency | null = null;
      if (enrollment.group.course.currency !== null) {
        if (!isFinanceCurrency(enrollment.group.course.currency)) {
          throw new Error('Invalid course currency');
        }
        courseCurrency = enrollment.group.course.currency;
      }
      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        groupId: enrollment.groupId,
        courseId: enrollment.group.courseId,
        serviceType: serviceType as CourseServiceType,
        teacherId: enrollment.group.teacherId,
        courseAmountMinor: enrollment.group.course.amountMinor,
        courseCurrency,
      };
    },

    async resolveTeacherIdForCharge(charge) {
      if (charge.classSessionId) {
        const session = await db.classSession.findUnique({
          where: { id: charge.classSessionId },
          include: { group: true },
        });
        return session?.group.teacherId ?? null;
      }
      if (charge.enrollmentId) {
        const enrollment = await db.enrollment.findUnique({
          where: { id: charge.enrollmentId },
          include: { group: true },
        });
        return enrollment?.group.teacherId ?? null;
      }
      throw new FinanceValidationError(
        'Charge has no commercial context for teacher resolution.',
      );
    },
  };

  return store;
}

export function createFinanceStore(
  database: Database,
  options?: { beforeCreateAllocationHook?: () => void | Promise<void> },
): FinanceStore {
  return createFinanceStoreForDb(database, database, {
    beforeCreateAllocationHook: options?.beforeCreateAllocationHook,
  });
}
