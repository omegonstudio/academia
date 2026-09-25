import { describe, expect, it } from 'vitest';
import type { Role } from '@academia/shared';
import {
  canMutateNotesUi,
  classNoteMutationErrorMessage,
  validateNoteContentDraft,
} from './class-session-notes.js';

describe('class session notes helpers', () => {
  it('keeps STUDENT read-only in the UX gate', () => {
    const roles: Role[] = [
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
      'STUDENT',
    ];
    expect(roles.filter((role) => canMutateNotesUi(role))).toEqual([
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
    ]);
    expect(canMutateNotesUi('STUDENT')).toBe(false);
  });

  it('validates note content drafts', () => {
    expect(validateNoteContentDraft('')).toMatch(/vacía/i);
    expect(validateNoteContentDraft('   ')).toMatch(/vacía/i);
    expect(validateNoteContentDraft('ok')).toBeNull();
    expect(validateNoteContentDraft('x'.repeat(4001))).toMatch(/4000/i);
  });

  it('maps note mutation HTTP errors', () => {
    expect(classNoteMutationErrorMessage(400)).toMatch(/4000/i);
    expect(classNoteMutationErrorMessage(403, 'create')).toMatch(/permiso/i);
    expect(classNoteMutationErrorMessage(403, 'delete')).toMatch(/eliminar/i);
    expect(classNoteMutationErrorMessage(404)).toMatch(/encontr/i);
    expect(classNoteMutationErrorMessage(500)).toMatch(/Intentá/i);
  });
});
