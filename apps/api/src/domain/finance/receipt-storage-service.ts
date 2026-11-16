import { randomUUID } from 'node:crypto';
import {
  isReceiptAllowedMimeType,
  sanitizeOriginalFilename,
  type CreateReceiptUploadRequest,
  type ReceiptDownloadResponse,
  type ReceiptUploadResponse,
} from '@academia/shared';
import type { ObjectStoragePort } from '../../storage/object-storage.js';
import {
  MATERIAL_MAGIC_PREFIX_BYTES,
  matchesMimeMagicBytes,
} from '../../storage/mime-magic.js';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import {
  getOwnedPaymentSubmission,
  serializePaymentSubmission,
} from './payment-submission-service.js';
import type { PaymentSubmissionStore } from './payment-submission-types.js';

/** Default limits — PDF/images only; antivirus deferred (documented). */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_UPLOAD_TTL_SECONDS = 15 * 60;
export const RECEIPT_DOWNLOAD_TTL_SECONDS = 5 * 60;

export function buildReceiptStorageKey(
  submissionId: string,
  now: Date = new Date(),
): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `receipts/${yyyy}/${mm}/${submissionId}/${randomUUID()}`;
}

/**
 * Start a private receipt upload for an owned submission.
 * Pending controls: malware/AV scanning is not implemented — magic-byte + MIME
 * + size + private bucket + short signed URLs only.
 */
export async function startReceiptUpload(
  submissions: PaymentSubmissionStore,
  storage: ObjectStoragePort,
  input: {
    studentId: string;
    submissionId: string;
    body: CreateReceiptUploadRequest;
  },
): Promise<ReceiptUploadResponse> {
  const submission = await getOwnedPaymentSubmission(submissions, {
    studentId: input.studentId,
    submissionId: input.submissionId,
  });
  if (
    submission.status !== 'SUBMITTED' &&
    submission.status !== 'NEEDS_CORRECTION'
  ) {
    throw new FinanceValidationError(
      `Receipt upload is only allowed for SUBMITTED or NEEDS_CORRECTION (got ${submission.status}).`,
    );
  }
  if (submission.receiptStorageKey) {
    throw new FinanceConflictError(
      'Submission already has a receipt. Request correction or create a new submission.',
    );
  }
  if (!isReceiptAllowedMimeType(input.body.mimeType)) {
    throw new FinanceValidationError('mimeType is not allowed for receipts.');
  }
  if (input.body.sizeBytes > RECEIPT_MAX_BYTES) {
    throw new FinanceValidationError(
      `sizeBytes exceeds the receipt limit of ${RECEIPT_MAX_BYTES} bytes.`,
    );
  }
  const filename = sanitizeOriginalFilename(input.body.originalFilename);
  if (!filename) {
    throw new FinanceValidationError(
      'originalFilename must be a safe basename.',
    );
  }
  const ext = filename.includes('.')
    ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
    : '';
  const expectedExt: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const want = expectedExt[input.body.mimeType];
  if (want && ext && ext !== want && !(want === '.jpg' && ext === '.jpeg')) {
    throw new FinanceValidationError(
      'originalFilename extension does not match mimeType.',
    );
  }

  const storageKey = buildReceiptStorageKey(submission.id);
  const updated = await submissions.update({
    id: submission.id,
    receiptStorageKey: storageKey,
    receiptFilename: filename,
    receiptMimeType: input.body.mimeType,
    receiptSizeBytes: input.body.sizeBytes,
  });

  const uploadUrl = await storage.createPresignedPutUrl({
    key: storageKey,
    contentType: input.body.mimeType,
    contentLength: input.body.sizeBytes,
    expiresInSeconds: RECEIPT_UPLOAD_TTL_SECONDS,
  });

  return {
    submission: serializePaymentSubmission(updated),
    uploadUrl,
    expiresInSeconds: RECEIPT_UPLOAD_TTL_SECONDS,
  };
}

export async function completeReceiptUpload(
  submissions: PaymentSubmissionStore,
  storage: ObjectStoragePort,
  input: { studentId: string; submissionId: string },
): Promise<ReturnType<typeof serializePaymentSubmission>> {
  const submission = await getOwnedPaymentSubmission(submissions, {
    studentId: input.studentId,
    submissionId: input.submissionId,
  });
  if (!submission.receiptStorageKey || !submission.receiptMimeType) {
    throw new FinanceValidationError('Submission is missing receipt metadata.');
  }
  if (!isReceiptAllowedMimeType(submission.receiptMimeType)) {
    throw new FinanceValidationError('Stored mimeType is not allowed.');
  }

  const head = await storage.head(submission.receiptStorageKey);
  if (!head) {
    throw new FinanceValidationError(
      'Uploaded receipt was not found in storage.',
    );
  }
  if (head.contentLength <= 0 || head.contentLength > RECEIPT_MAX_BYTES) {
    throw new FinanceValidationError(
      'Uploaded receipt size exceeds the configured limit.',
    );
  }

  const prefix = await storage.getPrefix(
    submission.receiptStorageKey,
    MATERIAL_MAGIC_PREFIX_BYTES,
  );
  if (
    !prefix ||
    !matchesMimeMagicBytes(
      submission.receiptMimeType as
        | 'application/pdf'
        | 'image/jpeg'
        | 'image/png'
        | 'image/webp',
      prefix,
    )
  ) {
    throw new FinanceValidationError(
      'Uploaded receipt content does not match the declared mimeType.',
    );
  }

  const updated = await submissions.update({
    id: submission.id,
    receiptSizeBytes: head.contentLength,
  });
  return serializePaymentSubmission(updated);
}

export async function getOwnedReceiptDownloadUrl(
  submissions: PaymentSubmissionStore,
  storage: ObjectStoragePort,
  input: { studentId: string; submissionId: string },
): Promise<ReceiptDownloadResponse> {
  const submission = await getOwnedPaymentSubmission(submissions, {
    studentId: input.studentId,
    submissionId: input.submissionId,
  });
  if (!submission.receiptStorageKey) {
    throw new FinanceNotFoundError('Receipt not found.');
  }
  const downloadUrl = await storage.getSignedGetUrl({
    key: submission.receiptStorageKey,
    expiresInSeconds: RECEIPT_DOWNLOAD_TTL_SECONDS,
    responseContentDisposition: submission.receiptFilename
      ? `attachment; filename="${submission.receiptFilename.replace(/"/g, '')}"`
      : undefined,
  });
  return {
    downloadUrl,
    expiresInSeconds: RECEIPT_DOWNLOAD_TTL_SECONDS,
    filename: submission.receiptFilename,
    mimeType: submission.receiptMimeType,
  };
}

/** Staff download — caller must enforce finance permissions separately (T5). */
export async function getStaffReceiptDownloadUrl(
  submissions: PaymentSubmissionStore,
  storage: ObjectStoragePort,
  input: { submissionId: string },
): Promise<ReceiptDownloadResponse> {
  const submission = await submissions.findById(input.submissionId);
  if (!submission?.receiptStorageKey) {
    throw new FinanceNotFoundError('Receipt not found.');
  }
  const downloadUrl = await storage.getSignedGetUrl({
    key: submission.receiptStorageKey,
    expiresInSeconds: RECEIPT_DOWNLOAD_TTL_SECONDS,
    responseContentDisposition: submission.receiptFilename
      ? `attachment; filename="${submission.receiptFilename.replace(/"/g, '')}"`
      : undefined,
  });
  return {
    downloadUrl,
    expiresInSeconds: RECEIPT_DOWNLOAD_TTL_SECONDS,
    filename: submission.receiptFilename,
    mimeType: submission.receiptMimeType,
  };
}
