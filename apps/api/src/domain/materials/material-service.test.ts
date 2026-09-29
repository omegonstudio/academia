import {
  MATERIAL_DEFAULT_MAX_IMAGE_BYTES,
  MATERIAL_DEFAULT_MAX_PDF_BYTES,
  sanitizeOriginalFilename,
} from '@academia/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryObjectStorage } from '../../storage/in-memory-object-storage.js';
import { createInMemoryMaterialStore } from './in-memory-material-store.js';
import {
  MaterialForbiddenError,
  MaterialNotFoundError,
  MaterialValidationError,
  assertXorAssociation,
  completeMaterialUpload,
  createFileUploadIntent,
  createLinkMaterial,
  downloadMaterial,
  getMaterial,
  listMaterials,
  maxBytesForMime,
  softDeleteMaterial,
  type MaterialSizeLimits,
  type MaterialUrlTtls,
} from './material-service.js';

const COURSE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_COURSE_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const TEACHER_A = '44444444-4444-4444-8444-444444444444';
const TEACHER_B = '55555555-5555-4555-8555-555555555555';
const STUDENT_A = '66666666-6666-4666-8666-666666666666';
const STUDENT_B = '77777777-7777-4777-8777-777777777777';
const USER_ID = '88888888-8888-4888-8888-888888888888';

const limits: MaterialSizeLimits = {
  maxPdfBytes: MATERIAL_DEFAULT_MAX_PDF_BYTES,
  maxImageBytes: MATERIAL_DEFAULT_MAX_IMAGE_BYTES,
  maxAudioBytes: 30 * 1024 * 1024,
};

const ttls: MaterialUrlTtls = {
  uploadUrlTtlSeconds: 900,
  downloadUrlTtlSeconds: 120,
};

describe('material-service', () => {
  let store = createInMemoryMaterialStore();
  let storage = createInMemoryObjectStorage();

  beforeEach(() => {
    store = createInMemoryMaterialStore();
    storage = createInMemoryObjectStorage();
    store.seedCourse(COURSE_ID);
    store.seedCourse(OTHER_COURSE_ID);
    store.seedClassSession(SESSION_ID, { teacherId: TEACHER_A });
    store.deps.teacherCourses.set(TEACHER_A, new Set([COURSE_ID]));
    store.deps.teacherCourses.set(TEACHER_B, new Set([OTHER_COURSE_ID]));
    store.deps.studentCourses.set(STUDENT_A, new Set([COURSE_ID]));
    store.deps.studentCourses.set(STUDENT_B, new Set([OTHER_COURSE_ID]));
  });

  describe('XOR association', () => {
    it('accepts exactly one of courseId or classSessionId', () => {
      expect(assertXorAssociation({ courseId: COURSE_ID })).toEqual({
        courseId: COURSE_ID,
        classSessionId: null,
      });
      expect(assertXorAssociation({ classSessionId: SESSION_ID })).toEqual({
        courseId: null,
        classSessionId: SESSION_ID,
      });
    });

    it('rejects neither or both', () => {
      expect(() => assertXorAssociation({})).toThrow(MaterialValidationError);
      expect(() =>
        assertXorAssociation({
          courseId: COURSE_ID,
          classSessionId: SESSION_ID,
        }),
      ).toThrow(MaterialValidationError);
    });
  });

  describe('LINK validation', () => {
    it('accepts https and rejects http/javascript/data', async () => {
      const ok = await createLinkMaterial(
        store,
        { mode: 'admin' },
        USER_ID,
        {
          title: 'Docs',
          kind: 'LINK',
          externalUrl: 'https://example.com/lesson',
          courseId: COURSE_ID,
        },
      );
      expect(ok.uploadStatus).toBe('READY');
      expect(ok.externalUrl).toBe('https://example.com/lesson');

      await expect(
        createLinkMaterial(store, { mode: 'admin' }, USER_ID, {
          title: 'Bad http',
          kind: 'LINK',
          externalUrl: 'http://example.com/x',
          courseId: COURSE_ID,
        }),
      ).rejects.toBeInstanceOf(MaterialValidationError);

      await expect(
        createLinkMaterial(store, { mode: 'admin' }, USER_ID, {
          title: 'Bad js',
          kind: 'LINK',
          externalUrl: 'javascript:alert(1)',
          courseId: COURSE_ID,
        }),
      ).rejects.toBeInstanceOf(MaterialValidationError);

      await expect(
        createLinkMaterial(store, { mode: 'admin' }, USER_ID, {
          title: 'Bad data',
          kind: 'LINK',
          externalUrl: 'data:text/html,hi',
          courseId: COURSE_ID,
        }),
      ).rejects.toBeInstanceOf(MaterialValidationError);
    });
  });

  describe('MIME allowlist and size limits', () => {
    it('rejects svg, video, and octet-stream', async () => {
      for (const mimeType of [
        'image/svg+xml',
        'video/mp4',
        'application/octet-stream',
      ]) {
        await expect(
          createFileUploadIntent(
            store,
            storage,
            { mode: 'admin' },
            USER_ID,
            {
              title: 'Bad mime',
              mimeType: mimeType as 'application/pdf',
              sizeBytes: 100,
              originalFilename: 'x.bin',
              courseId: COURSE_ID,
            },
            limits,
            ttls,
          ),
        ).rejects.toBeInstanceOf(MaterialValidationError);
      }
    });

    it('enforces size limits by MIME category', async () => {
      expect(maxBytesForMime('application/pdf', limits)).toBe(
        limits.maxPdfBytes,
      );
      expect(maxBytesForMime('image/png', limits)).toBe(limits.maxImageBytes);

      await expect(
        createFileUploadIntent(
          store,
          storage,
          { mode: 'admin' },
          USER_ID,
          {
            title: 'Huge image',
            mimeType: 'image/png',
            sizeBytes: limits.maxImageBytes + 1,
            originalFilename: 'big.png',
            courseId: COURSE_ID,
          },
          limits,
          ttls,
        ),
      ).rejects.toThrow(/sizeBytes exceeds/);
    });
  });

  describe('filename sanitization', () => {
    it('strips path traversal and keeps basename', () => {
      expect(sanitizeOriginalFilename('../../etc/passwd')).toBe('passwd');
      expect(sanitizeOriginalFilename('C:\\Windows\\notes.pdf')).toBe(
        'notes.pdf',
      );
      expect(sanitizeOriginalFilename('..')).toBeNull();
      expect(sanitizeOriginalFilename('')).toBeNull();
    });

    it('rejects unsafe filenames at upload intent', async () => {
      await expect(
        createFileUploadIntent(
          store,
          storage,
          { mode: 'admin' },
          USER_ID,
          {
            title: 'Bad name',
            mimeType: 'application/pdf',
            sizeBytes: 100,
            originalFilename: '..',
            courseId: COURSE_ID,
          },
          limits,
          ttls,
        ),
      ).rejects.toBeInstanceOf(MaterialValidationError);
    });
  });

  describe('teacher ownership', () => {
    it('allows owning teacher and rejects foreign teacher', async () => {
      const material = await createLinkMaterial(
        store,
        { mode: 'teacher', teacherId: TEACHER_A },
        USER_ID,
        {
          title: 'Owned',
          kind: 'LINK',
          externalUrl: 'https://example.com/a',
          courseId: COURSE_ID,
        },
      );
      expect(material.courseId).toBe(COURSE_ID);

      await expect(
        createLinkMaterial(
          store,
          { mode: 'teacher', teacherId: TEACHER_B },
          USER_ID,
          {
            title: 'Foreign',
            kind: 'LINK',
            externalUrl: 'https://example.com/b',
            courseId: COURSE_ID,
          },
        ),
      ).rejects.toBeInstanceOf(MaterialForbiddenError);
    });
  });

  describe('student entitlement', () => {
    it('allows READY for entitled student; rejects PENDING and other course', async () => {
      const link = await createLinkMaterial(
        store,
        { mode: 'admin' },
        USER_ID,
        {
          title: 'Ready link',
          kind: 'LINK',
          externalUrl: 'https://example.com/ready',
          courseId: COURSE_ID,
        },
      );

      await expect(
        getMaterial(store, { mode: 'student', studentId: STUDENT_A }, link.id),
      ).resolves.toMatchObject({ id: link.id, uploadStatus: 'READY' });

      const pending = await createFileUploadIntent(
        store,
        storage,
        { mode: 'admin' },
        USER_ID,
        {
          title: 'Pending file',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          originalFilename: 'p.pdf',
          courseId: COURSE_ID,
        },
        limits,
        ttls,
      );

      await expect(
        getMaterial(
          store,
          { mode: 'student', studentId: STUDENT_A },
          pending.material.id,
        ),
      ).rejects.toBeInstanceOf(MaterialForbiddenError);

      await expect(
        getMaterial(store, { mode: 'student', studentId: STUDENT_B }, link.id),
      ).rejects.toBeInstanceOf(MaterialForbiddenError);

      const listed = await listMaterials(store, {
        courseId: COURSE_ID,
        actor: { mode: 'student', studentId: STUDENT_A },
      });
      expect(listed.every((m) => m.uploadStatus === 'READY')).toBe(true);
      expect(listed.map((m) => m.id)).toContain(link.id);
      expect(listed.map((m) => m.id)).not.toContain(pending.material.id);
    });
  });

  describe('soft delete', () => {
    it('marks inactive and hides from get', async () => {
      const material = await createLinkMaterial(
        store,
        { mode: 'admin' },
        USER_ID,
        {
          title: 'To delete',
          kind: 'LINK',
          externalUrl: 'https://example.com/del',
          courseId: COURSE_ID,
        },
      );

      await softDeleteMaterial(
        store,
        storage,
        { mode: 'admin' },
        material.id,
        () => undefined,
      );

      const record = store.records.get(material.id);
      expect(record?.isActive).toBe(false);

      await expect(
        getMaterial(store, { mode: 'admin' }, material.id),
      ).rejects.toBeInstanceOf(MaterialNotFoundError);
    });
  });

  describe('complete upload', () => {
    it('errors when object missing; magic mismatch; succeeds PENDING→READY', async () => {
      const intent = await createFileUploadIntent(
        store,
        storage,
        { mode: 'admin' },
        USER_ID,
        {
          title: 'PDF',
          mimeType: 'application/pdf',
          sizeBytes: 20,
          originalFilename: 'doc.pdf',
          courseId: COURSE_ID,
        },
        limits,
        ttls,
      );
      const id = intent.material.id;
      const record = store.records.get(id)!;
      expect(record.storageKey).toBeTruthy();
      expect(intent.material.uploadStatus).toBe('PENDING');

      await expect(
        completeMaterialUpload(
          store,
          storage,
          { mode: 'admin' },
          id,
          limits,
        ),
      ).rejects.toThrow(/not found in storage/);

      storage.put(
        record.storageKey!,
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(16)]),
        'application/pdf',
      );
      await expect(
        completeMaterialUpload(
          store,
          storage,
          { mode: 'admin' },
          id,
          limits,
        ),
      ).rejects.toThrow(/does not match/);

      const pdfBody = Buffer.from('%PDF-1.7\n% content here\n');
      storage.put(record.storageKey!, pdfBody, 'application/pdf');
      const ready = await completeMaterialUpload(
        store,
        storage,
        { mode: 'admin' },
        id,
        limits,
      );
      expect(ready.uploadStatus).toBe('READY');
      expect(ready.sizeBytes).toBe(pdfBody.length);

      const download = await downloadMaterial(
        store,
        storage,
        { mode: 'admin' },
        id,
        ttls,
      );
      expect(download.kind).toBe('FILE');
      expect(download.downloadUrl).toContain('storage.test/download');
    });
  });

  it('builds distinct storage keys without path traversal from filename', async () => {
    const a = await createFileUploadIntent(
      store,
      storage,
      { mode: 'admin' },
      USER_ID,
      {
        title: 'A',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        originalFilename: '../../evil.pdf',
        courseId: COURSE_ID,
      },
      limits,
      ttls,
    );
    const key = store.records.get(a.material.id)?.storageKey ?? '';
    expect(key.startsWith('materials/')).toBe(true);
    expect(key.includes('..')).toBe(false);
    expect(a.material.originalFilename).toBe('evil.pdf');
    expect(a.material).not.toHaveProperty('storageKey');
  });
});
