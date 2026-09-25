import { describe, expect, it } from 'vitest';
import type { Role } from '@academia/shared';
import {
  canShowGenerateUi,
  formatGenerateResultSummary,
  generateClassSessionsErrorMessage,
  isCivilDateInput,
  validateGenerateDateRange,
} from './class-session-generate.js';

describe('class session generate helpers', () => {
  it('accepts valid civil dates and rejects invalid ones', () => {
    expect(isCivilDateInput('2026-09-14')).toBe(true);
    expect(isCivilDateInput('2026-02-29')).toBe(false);
    expect(isCivilDateInput('14-09-2026')).toBe(false);
    expect(isCivilDateInput('')).toBe(false);
  });

  it('validates a generation range for submission', () => {
    expect(validateGenerateDateRange('2026-09-14', '2026-09-21')).toEqual({
      ok: true,
      from: '2026-09-14',
      to: '2026-09-21',
      dayCount: 8,
    });
    expect(validateGenerateDateRange('', '2026-09-21').ok).toBe(false);
    expect(validateGenerateDateRange('2026-09-21', '2026-09-14').ok).toBe(false);
    expect(validateGenerateDateRange('bad', '2026-09-21').ok).toBe(false);
    expect(
      validateGenerateDateRange('2026-01-01', '2026-04-10', 90).ok,
    ).toBe(false);
  });

  it('hides generate UI for STUDENT only', () => {
    const roles: Role[] = [
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
      'STUDENT',
    ];
    expect(roles.filter((role) => canShowGenerateUi(role))).toEqual([
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
    ]);
    expect(canShowGenerateUi('STUDENT')).toBe(false);
  });

  it('maps generate HTTP errors', () => {
    expect(generateClassSessionsErrorMessage(400)).toMatch(/franja|rango/i);
    expect(generateClassSessionsErrorMessage(403)).toMatch(/permiso/i);
    expect(generateClassSessionsErrorMessage(404)).toMatch(/grupo/i);
    expect(generateClassSessionsErrorMessage(409)).toMatch(/conflicto/i);
    expect(generateClassSessionsErrorMessage(500)).toMatch(/Intentá/i);
  });

  it('formats API result counts without inventing values', () => {
    expect(
      formatGenerateResultSummary({
        from: '2026-09-14',
        to: '2026-10-11',
        generatedCount: 4,
        skippedCount: 0,
        conflictCount: 1,
      }),
    ).toBe(
      'Rango 2026-09-14 → 2026-10-11: 4 creadas, 0 omitidas (ya existían), 1 omitidas por conflicto de horario.',
    );
  });
});
