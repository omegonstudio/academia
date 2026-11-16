import type {
  FinanceCurrency,
  PaymentSubmissionStatus,
} from '@academia/shared';
import { isFinanceCurrency } from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import { FinanceConflictError } from './finance-errors.js';
import type {
  PaymentSubmissionEventRecord,
  PaymentSubmissionRecord,
  PaymentSubmissionStore,
} from './payment-submission-types.js';

type TxClient = Parameters<Parameters<Database['$transaction']>[0]>[0];
type SubmissionDb = Database | TxClient;

function mapSubmission(row: {
  id: string;
  chargeId: string;
  studentId: string;
  reportedAmountMinor: bigint;
  reportedCurrency: string;
  paidAt: Date;
  receiptStorageKey: string | null;
  receiptFilename: string | null;
  receiptMimeType: string | null;
  receiptSizeBytes: number | null;
  status: PaymentSubmissionStatus;
  studentNote: string | null;
  adminNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentSubmissionRecord {
  if (!isFinanceCurrency(row.reportedCurrency)) {
    throw new Error(
      `Invalid reportedCurrency in database: ${row.reportedCurrency}`,
    );
  }
  return {
    id: row.id,
    chargeId: row.chargeId,
    studentId: row.studentId,
    reportedAmountMinor: row.reportedAmountMinor,
    reportedCurrency: row.reportedCurrency,
    paidAt: row.paidAt,
    receiptStorageKey: row.receiptStorageKey,
    receiptFilename: row.receiptFilename,
    receiptMimeType: row.receiptMimeType,
    receiptSizeBytes: row.receiptSizeBytes,
    status: row.status,
    studentNote: row.studentNote,
    adminNote: row.adminNote,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEvent(row: {
  id: string;
  submissionId: string;
  fromStatus: PaymentSubmissionStatus | null;
  toStatus: PaymentSubmissionStatus;
  actorUserId: string | null;
  note: string | null;
  createdAt: Date;
}): PaymentSubmissionEventRecord {
  return {
    id: row.id,
    submissionId: row.submissionId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actorUserId: row.actorUserId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

function createStore(db: SubmissionDb): PaymentSubmissionStore {
  return {
    async findById(id) {
      const row = await db.paymentSubmission.findUnique({ where: { id } });
      return row ? mapSubmission(row) : null;
    },

    async list(filters) {
      const rows = await db.paymentSubmission.findMany({
        where: {
          ...(filters.studentId ? { studentId: filters.studentId } : {}),
          ...(filters.chargeId ? { chargeId: filters.chargeId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapSubmission);
    },

    async create(input) {
      try {
        const row = await db.paymentSubmission.create({
          data: {
            chargeId: input.chargeId,
            studentId: input.studentId,
            reportedAmountMinor: input.reportedAmountMinor,
            reportedCurrency: input.reportedCurrency as FinanceCurrency,
            paidAt: input.paidAt,
            studentNote: input.studentNote,
            receiptStorageKey: input.receiptStorageKey ?? null,
            receiptFilename: input.receiptFilename ?? null,
            receiptMimeType: input.receiptMimeType ?? null,
            receiptSizeBytes: input.receiptSizeBytes ?? null,
          },
        });
        return mapSubmission(row);
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        if (code === 'P2002') {
          throw new FinanceConflictError(
            'PaymentSubmission unique constraint violated.',
          );
        }
        throw error;
      }
    },

    async update(input) {
      try {
        const row = await db.paymentSubmission.update({
          where: { id: input.id },
          data: {
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.adminNote !== undefined
              ? { adminNote: input.adminNote }
              : {}),
            ...(input.reviewedByUserId !== undefined
              ? { reviewedByUserId: input.reviewedByUserId }
              : {}),
            ...(input.reviewedAt !== undefined
              ? { reviewedAt: input.reviewedAt }
              : {}),
            ...(input.receiptStorageKey !== undefined
              ? { receiptStorageKey: input.receiptStorageKey }
              : {}),
            ...(input.receiptFilename !== undefined
              ? { receiptFilename: input.receiptFilename }
              : {}),
            ...(input.receiptMimeType !== undefined
              ? { receiptMimeType: input.receiptMimeType }
              : {}),
            ...(input.receiptSizeBytes !== undefined
              ? { receiptSizeBytes: input.receiptSizeBytes }
              : {}),
          },
        });
        return mapSubmission(row);
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        if (code === 'P2002') {
          throw new FinanceConflictError(
            'PaymentSubmission unique constraint violated.',
          );
        }
        throw error;
      }
    },

    async appendEvent(input) {
      const row = await db.paymentSubmissionEvent.create({
        data: {
          submissionId: input.submissionId,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          actorUserId: input.actorUserId,
          note: input.note,
        },
      });
      return mapEvent(row);
    },

    async listEvents(submissionId) {
      const rows = await db.paymentSubmissionEvent.findMany({
        where: { submissionId },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(mapEvent);
    },

    async runInTransaction(fn) {
      if ('$transaction' in db && typeof db.$transaction === 'function') {
        return db.$transaction(async (tx) => fn(createStore(tx)));
      }
      return fn(createStore(db));
    },
  };
}

export function createPrismaPaymentSubmissionStore(
  db: Database,
): PaymentSubmissionStore {
  return createStore(db);
}
