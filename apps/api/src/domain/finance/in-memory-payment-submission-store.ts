import { randomUUID } from 'node:crypto';
import { FinanceConflictError } from './finance-errors.js';
import type {
  PaymentSubmissionEventRecord,
  PaymentSubmissionRecord,
  PaymentSubmissionStore,
} from './payment-submission-types.js';

function cloneSubmission(
  row: PaymentSubmissionRecord,
): PaymentSubmissionRecord {
  return { ...row };
}

function cloneEvent(
  row: PaymentSubmissionEventRecord,
): PaymentSubmissionEventRecord {
  return { ...row };
}

export function createInMemoryPaymentSubmissionStore(): PaymentSubmissionStore & {
  clear(): void;
} {
  const submissions = new Map<string, PaymentSubmissionRecord>();
  const events = new Map<string, PaymentSubmissionEventRecord>();

  const store: PaymentSubmissionStore & { clear(): void } = {
    clear() {
      submissions.clear();
      events.clear();
    },

    async findById(id) {
      const row = submissions.get(id);
      return row ? cloneSubmission(row) : null;
    },

    async list(filters) {
      return [...submissions.values()]
        .filter((row) => {
          if (filters.studentId && row.studentId !== filters.studentId) {
            return false;
          }
          if (filters.chargeId && row.chargeId !== filters.chargeId) {
            return false;
          }
          if (filters.status && row.status !== filters.status) return false;
          return true;
        })
        .map(cloneSubmission)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async create(input) {
      for (const row of submissions.values()) {
        if (row.status === 'APPROVED' && row.chargeId === input.chargeId) {
          throw new FinanceConflictError(
            'Charge already has an APPROVED PaymentSubmission.',
          );
        }
        if (
          input.receiptStorageKey &&
          row.receiptStorageKey === input.receiptStorageKey
        ) {
          throw new FinanceConflictError(
            'receiptStorageKey already used.',
          );
        }
      }
      const now = new Date();
      const row: PaymentSubmissionRecord = {
        id: randomUUID(),
        chargeId: input.chargeId,
        studentId: input.studentId,
        reportedAmountMinor: input.reportedAmountMinor,
        reportedCurrency: input.reportedCurrency,
        paidAt: input.paidAt,
        receiptStorageKey: input.receiptStorageKey ?? null,
        receiptFilename: input.receiptFilename ?? null,
        receiptMimeType: input.receiptMimeType ?? null,
        receiptSizeBytes: input.receiptSizeBytes ?? null,
        status: 'SUBMITTED',
        studentNote: input.studentNote,
        adminNote: null,
        reviewedByUserId: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      submissions.set(row.id, row);
      return cloneSubmission(row);
    },

    async update(input) {
      const existing = submissions.get(input.id);
      if (!existing) {
        throw new FinanceConflictError('PaymentSubmission not found.');
      }
      if (input.status === 'APPROVED') {
        for (const row of submissions.values()) {
          if (
            row.id !== input.id &&
            row.chargeId === existing.chargeId &&
            row.status === 'APPROVED'
          ) {
            throw new FinanceConflictError(
              'Charge already has an APPROVED PaymentSubmission.',
            );
          }
        }
      }
      const updated: PaymentSubmissionRecord = {
        ...existing,
        status: input.status ?? existing.status,
        adminNote:
          input.adminNote !== undefined ? input.adminNote : existing.adminNote,
        reviewedByUserId:
          input.reviewedByUserId !== undefined
            ? input.reviewedByUserId
            : existing.reviewedByUserId,
        reviewedAt:
          input.reviewedAt !== undefined
            ? input.reviewedAt
            : existing.reviewedAt,
        receiptStorageKey:
          input.receiptStorageKey !== undefined
            ? input.receiptStorageKey
            : existing.receiptStorageKey,
        receiptFilename:
          input.receiptFilename !== undefined
            ? input.receiptFilename
            : existing.receiptFilename,
        receiptMimeType:
          input.receiptMimeType !== undefined
            ? input.receiptMimeType
            : existing.receiptMimeType,
        receiptSizeBytes:
          input.receiptSizeBytes !== undefined
            ? input.receiptSizeBytes
            : existing.receiptSizeBytes,
        updatedAt: new Date(),
      };
      submissions.set(updated.id, updated);
      return cloneSubmission(updated);
    },

    async appendEvent(input) {
      const row: PaymentSubmissionEventRecord = {
        id: randomUUID(),
        submissionId: input.submissionId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actorUserId,
        note: input.note,
        createdAt: new Date(),
      };
      events.set(row.id, row);
      return cloneEvent(row);
    },

    async listEvents(submissionId) {
      return [...events.values()]
        .filter((row) => row.submissionId === submissionId)
        .map(cloneEvent)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },

    async runInTransaction(fn) {
      return fn(store);
    },
  };

  return store;
}
