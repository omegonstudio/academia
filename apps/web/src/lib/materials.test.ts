import { describe, expect, it } from 'vitest';
import type { Role } from '@academia/shared';
import {
  canMutateMaterialsUi,
  formatBytes,
  materialMutationErrorMessage,
  materialsListPath,
  maxBytesForMime,
  validateMaterialExternalUrlDraft,
  validateMaterialFile,
  validateMaterialTitleDraft,
} from './materials.js';

describe('materials helpers', () => {
  it('keeps STUDENT read-only in the UX gate', () => {
    const roles: Role[] = [
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
      'STUDENT',
    ];
    expect(roles.filter((role) => canMutateMaterialsUi(role))).toEqual([
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
    ]);
    expect(canMutateMaterialsUi('STUDENT')).toBe(false);
  });

  it('builds list paths with exactly one scope query', () => {
    expect(materialsListPath({ courseId: 'course-1' })).toBe(
      '/materials?courseId=course-1',
    );
    expect(materialsListPath({ classSessionId: 'session-1' })).toBe(
      '/materials?classSessionId=session-1',
    );
    expect(
      materialsListPath({ courseId: 'a/b' }),
    ).toBe('/materials?courseId=a%2Fb');
  });

  it('rejects list paths with both or neither scope', () => {
    expect(() =>
      materialsListPath({
        courseId: 'c1',
        classSessionId: 's1',
      } as never),
    ).toThrow(/exactly one/i);
    expect(() => materialsListPath({} as never)).toThrow(/exactly one/i);
  });

  it('validates LINK URL drafts (HTTPS only)', () => {
    expect(validateMaterialExternalUrlDraft('')).toMatch(/obligatoria/i);
    expect(validateMaterialExternalUrlDraft('http://example.com')).toMatch(
      /HTTPS/i,
    );
    expect(validateMaterialExternalUrlDraft('javascript:alert(1)')).toMatch(
      /HTTPS/i,
    );
    expect(
      validateMaterialExternalUrlDraft('https://example.com/handout'),
    ).toBeNull();
    expect(validateMaterialTitleDraft('')).toMatch(/obligatorio/i);
    expect(validateMaterialTitleDraft('Guía')).toBeNull();
  });

  it('validates file MIME and size against known limits', () => {
    expect(maxBytesForMime('application/pdf')).toBe(20 * 1024 * 1024);
    expect(maxBytesForMime('image/png')).toBe(5 * 1024 * 1024);
    expect(maxBytesForMime('audio/mpeg')).toBe(30 * 1024 * 1024);

    const okPdf = new File([new Uint8Array(100)], 'a.pdf', {
      type: 'application/pdf',
    });
    expect(validateMaterialFile(okPdf)).toBeNull();

    const svg = new File([new Uint8Array(10)], 'x.svg', {
      type: 'image/svg+xml',
    });
    expect(validateMaterialFile(svg)).toMatch(/no permitido/i);

    const video = new File([new Uint8Array(10)], 'x.mp4', {
      type: 'video/mp4',
    });
    expect(validateMaterialFile(video)).toMatch(/no permitido/i);

    const hugeImage = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      'big.png',
      { type: 'image/png' },
    );
    expect(validateMaterialFile(hugeImage)).toMatch(/límite/i);
  });

  it('formats byte sizes for display', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toMatch(/KB/);
    expect(formatBytes(2 * 1024 * 1024)).toMatch(/MB/);
  });

  it('maps materials mutation HTTP errors including 403', () => {
    expect(materialMutationErrorMessage(403, 'create')).toMatch(/permiso/i);
    expect(materialMutationErrorMessage(403, 'delete')).toMatch(/eliminar/i);
    expect(materialMutationErrorMessage(403, 'download')).toMatch(/ver/i);
    expect(materialMutationErrorMessage(400, 'upload')).toMatch(/archivo/i);
    expect(materialMutationErrorMessage(413)).toMatch(/grande/i);
    expect(materialMutationErrorMessage(401)).toMatch(/sesión/i);
    expect(materialMutationErrorMessage(404)).toMatch(/encontr/i);
  });
});
