import type {
  FinanceCurrency,
  PaymentSubmissionStatus,
} from '@academia/shared';

export interface PaymentSubmissionRecord {
  id: string;
  chargeId: string;
  studentId: string;
  reportedAmountMinor: bigint;
  reportedCurrency: FinanceCurrency;
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
}

export interface PaymentSubmissionEventRecord {
  id: string;
  submissionId: string;
  fromStatus: PaymentSubmissionStatus | null;
  toStatus: PaymentSubmissionStatus;
  actorUserId: string | null;
  note: string | null;
  createdAt: Date;
}

export interface PaymentSubmissionStore {
  findById(id: string): Promise<PaymentSubmissionRecord | null>;
  list(filters: {
    studentId?: string;
    chargeId?: string;
    status?: PaymentSubmissionStatus;
  }): Promise<PaymentSubmissionRecord[]>;
  create(input: {
    chargeId: string;
    studentId: string;
    reportedAmountMinor: bigint;
    reportedCurrency: FinanceCurrency;
    paidAt: Date;
    studentNote: string | null;
    receiptStorageKey?: string | null;
    receiptFilename?: string | null;
    receiptMimeType?: string | null;
    receiptSizeBytes?: number | null;
  }): Promise<PaymentSubmissionRecord>;
  update(input: {
    id: string;
    status?: PaymentSubmissionStatus;
    adminNote?: string | null;
    reviewedByUserId?: string | null;
    reviewedAt?: Date | null;
    receiptStorageKey?: string | null;
    receiptFilename?: string | null;
    receiptMimeType?: string | null;
    receiptSizeBytes?: number | null;
  }): Promise<PaymentSubmissionRecord>;
  appendEvent(input: {
    submissionId: string;
    fromStatus: PaymentSubmissionStatus | null;
    toStatus: PaymentSubmissionStatus;
    actorUserId: string | null;
    note: string | null;
  }): Promise<PaymentSubmissionEventRecord>;
  listEvents(submissionId: string): Promise<PaymentSubmissionEventRecord[]>;
  runInTransaction<T>(
    fn: (tx: PaymentSubmissionStore) => Promise<T>,
  ): Promise<T>;
}
