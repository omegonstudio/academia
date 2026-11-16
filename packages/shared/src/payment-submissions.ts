import { z } from 'zod';
import {
  financeCurrencySchema,
  nonNegativeMoneyMinorStringSchema,
} from './finance.js';

export const PAYMENT_SUBMISSION_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_CORRECTION',
  'APPROVED',
  'REJECTED',
] as const;
export type PaymentSubmissionStatus =
  (typeof PAYMENT_SUBMISSION_STATUSES)[number];
export const paymentSubmissionStatusSchema = z.enum(PAYMENT_SUBMISSION_STATUSES);

export const paymentSubmissionSchema = z.object({
  id: z.string().uuid(),
  chargeId: z.string().uuid(),
  studentId: z.string().uuid(),
  reportedAmountMinor: nonNegativeMoneyMinorStringSchema,
  reportedCurrency: financeCurrencySchema,
  paidAt: z.string().datetime(),
  /** Present when a receipt file was attached; never exposes storageKey. */
  hasReceipt: z.boolean(),
  receiptFilename: z.string().max(255).nullable(),
  receiptMimeType: z.string().max(100).nullable(),
  receiptSizeBytes: z.number().int().nonnegative().nullable(),
  status: paymentSubmissionStatusSchema,
  studentNote: z.string().max(1000).nullable(),
  adminNote: z.string().max(2000).nullable(),
  reviewedByUserId: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentSubmission = z.infer<typeof paymentSubmissionSchema>;

export const paymentSubmissionListResponseSchema = z.object({
  submissions: z.array(paymentSubmissionSchema),
});
export type PaymentSubmissionListResponse = z.infer<
  typeof paymentSubmissionListResponseSchema
>;

export const paymentSubmissionResponseSchema = z.object({
  submission: paymentSubmissionSchema,
});
export type PaymentSubmissionResponse = z.infer<
  typeof paymentSubmissionResponseSchema
>;

/** Student creates a receipt report. File upload is completed in T4. */
export const createPaymentSubmissionRequestSchema = z.object({
  chargeId: z.string().uuid(),
  reportedAmountMinor: nonNegativeMoneyMinorStringSchema,
  reportedCurrency: financeCurrencySchema,
  paidAt: z.string().datetime(),
  studentNote: z.string().max(1000).optional(),
});
export type CreatePaymentSubmissionRequest = z.infer<
  typeof createPaymentSubmissionRequestSchema
>;

export const RECEIPT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type ReceiptAllowedMimeType =
  (typeof RECEIPT_ALLOWED_MIME_TYPES)[number];
export const receiptAllowedMimeTypeSchema = z.enum(RECEIPT_ALLOWED_MIME_TYPES);

export function isReceiptAllowedMimeType(
  value: string,
): value is ReceiptAllowedMimeType {
  return (RECEIPT_ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export const createReceiptUploadRequestSchema = z.object({
  mimeType: receiptAllowedMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  originalFilename: z.string().min(1).max(255),
});
export type CreateReceiptUploadRequest = z.infer<
  typeof createReceiptUploadRequestSchema
>;

export const receiptUploadResponseSchema = z.object({
  submission: paymentSubmissionSchema,
  uploadUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});
export type ReceiptUploadResponse = z.infer<typeof receiptUploadResponseSchema>;

export const receiptDownloadResponseSchema = z.object({
  downloadUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
  filename: z.string().nullable(),
  mimeType: z.string().nullable(),
});
export type ReceiptDownloadResponse = z.infer<
  typeof receiptDownloadResponseSchema
>;
