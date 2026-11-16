import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryObjectStorage } from '../../storage/in-memory-object-storage.js';
import {
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from './finance-errors.js';
import { getOrCreateFinanceSettings } from './finance-settings-service.js';
import { createInMemoryFinanceStore } from './in-memory-finance-store.js';
import { createInMemoryPaymentSubmissionStore } from './in-memory-payment-submission-store.js';
import { createPaymentSubmission } from './payment-submission-service.js';
import {
  buildReceiptStorageKey,
  completeReceiptUpload,
  getOwnedReceiptDownloadUrl,
  startReceiptUpload,
} from './receipt-storage-service.js';

describe('receipt-storage-service', () => {
  const finance = createInMemoryFinanceStore();
  const submissions = createInMemoryPaymentSubmissionStore();
  let storage = createInMemoryObjectStorage();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const otherStudentId = randomUUID();
  const actorUserId = randomUUID();
  let chargeId: string;
  let submissionId: string;

  beforeEach(async () => {
    finance.clear();
    submissions.clear();
    storage = createInMemoryObjectStorage();
    await getOrCreateFinanceSettings(finance);
    const classSessionId = randomUUID();
    const courseId = randomUUID();
    const groupId = randomUUID();
    finance.seedClassSession({
      classSessionId,
      studentId,
      groupId,
      courseId,
      serviceType: 'ONE_TO_ONE_60',
      teacherId,
      courseAmountMinor: 12500n,
      courseCurrency: 'ARS',
      studentEnrolled: true,
    });
    const charge = await finance.createCharge({
      studentId,
      amountMinor: 12500n,
      currency: 'ARS',
      courseId,
      groupId,
      enrollmentId: null,
      classSessionId,
      periodStart: null,
      periodEnd: null,
      description: null,
      createdByUserId: actorUserId,
    });
    chargeId = charge.id;
    const created = await createPaymentSubmission(finance, submissions, {
      studentId,
      actorUserId,
      body: {
        chargeId,
        reportedAmountMinor: '12500',
        reportedCurrency: 'ARS',
        paidAt: '2026-11-16T15:00:00.000Z',
      },
    });
    submissionId = created.id;
  });

  it('builds receipts/ prefix keys', () => {
    expect(buildReceiptStorageKey(submissionId)).toMatch(
      /^receipts\/\d{4}\/\d{2}\//,
    );
  });

  it('presigns upload, completes with magic bytes, and signs download for owner', async () => {
    const pdf = Buffer.from('%PDF-1.4 fake content for magic check');
    const intent = await startReceiptUpload(submissions, storage, {
      studentId,
      submissionId,
      body: {
        mimeType: 'application/pdf',
        sizeBytes: pdf.length,
        originalFilename: 'comprobante.pdf',
      },
    });
    expect(intent.uploadUrl).toBeTruthy();
    expect(intent.submission.hasReceipt).toBe(true);
    expect(intent.submission.receiptFilename).toBe('comprobante.pdf');

    const key = (await submissions.findById(submissionId))!.receiptStorageKey!;
    storage.put(key, pdf, 'application/pdf');

    const completed = await completeReceiptUpload(submissions, storage, {
      studentId,
      submissionId,
    });
    expect(completed.hasReceipt).toBe(true);
    expect(completed.receiptSizeBytes).toBe(pdf.length);

    const download = await getOwnedReceiptDownloadUrl(submissions, storage, {
      studentId,
      submissionId,
    });
    expect(download.downloadUrl).toBeTruthy();
    expect(download.filename).toBe('comprobante.pdf');
  });

  it('rejects foreign student, invalid mime, and cross-student download', async () => {
    await expect(
      startReceiptUpload(submissions, storage, {
        studentId: otherStudentId,
        submissionId,
        body: {
          mimeType: 'application/pdf',
          sizeBytes: 100,
          originalFilename: 'x.pdf',
        },
      }),
    ).rejects.toBeInstanceOf(FinanceNotFoundError);

    await expect(
      startReceiptUpload(submissions, storage, {
        studentId,
        submissionId,
        body: {
          mimeType: 'audio/mpeg' as 'application/pdf',
          sizeBytes: 100,
          originalFilename: 'x.mp3',
        },
      }),
    ).rejects.toBeInstanceOf(FinanceValidationError);

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const intent = await startReceiptUpload(submissions, storage, {
      studentId,
      submissionId,
      body: {
        mimeType: 'image/png',
        sizeBytes: png.length,
        originalFilename: 'shot.png',
      },
    });
    const key = (await submissions.findById(submissionId))!.receiptStorageKey!;
    storage.put(key, png, 'image/png');
    await completeReceiptUpload(submissions, storage, {
      studentId,
      submissionId,
    });

    await expect(
      getOwnedReceiptDownloadUrl(submissions, storage, {
        studentId: otherStudentId,
        submissionId,
      }),
    ).rejects.toBeInstanceOf(FinanceNotFoundError);

    await expect(
      startReceiptUpload(submissions, storage, {
        studentId,
        submissionId,
        body: {
          mimeType: 'application/pdf',
          sizeBytes: 50,
          originalFilename: 'again.pdf',
        },
      }),
    ).rejects.toBeInstanceOf(FinanceConflictError);

    expect(intent.submission.id).toBe(submissionId);
  });

  it('rejects complete when magic bytes do not match', async () => {
    const intent = await startReceiptUpload(submissions, storage, {
      studentId,
      submissionId,
      body: {
        mimeType: 'application/pdf',
        sizeBytes: 20,
        originalFilename: 'bad.pdf',
      },
    });
    const key = (await submissions.findById(submissionId))!.receiptStorageKey!;
    storage.put(key, Buffer.from('not-a-pdf-file!!!!!!!'), 'application/pdf');
    await expect(
      completeReceiptUpload(submissions, storage, {
        studentId,
        submissionId,
      }),
    ).rejects.toBeInstanceOf(FinanceValidationError);
    expect(intent.uploadUrl).toBeTruthy();
  });
});
