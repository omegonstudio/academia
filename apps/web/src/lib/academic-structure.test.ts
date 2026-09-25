import { describe, expect, it } from 'vitest';
import type { Role } from '@academia/shared';
import {
  academicMutationErrorMessage,
  canMutateAcademicStructureUi,
  courseTypeLabel,
  courseServiceTypeLabel,
  derivedDurationLabel,
  enrollmentCapacityLabel,
  isAtEnrollmentCapacity,
} from './academic-structure.js';

describe('academic structure labels', () => {
  it('labels course and service types with derived duration', () => {
    expect(courseTypeLabel('REGULAR')).toMatch(/Regular/i);
    expect(courseTypeLabel('TEACHER_TRAINING')).toMatch(/Formación/i);
    expect(courseServiceTypeLabel('ONE_TO_ONE_60')).toContain('60');
    expect(courseServiceTypeLabel('GROUP_120')).toContain('120');
    expect(derivedDurationLabel('ONE_TO_ONE_90')).toBe('90 min');
  });

  it('represents capacity 15 for enrollment UX', () => {
    expect(enrollmentCapacityLabel(0)).toBe('0 / 15');
    expect(enrollmentCapacityLabel(15)).toBe('15 / 15');
    expect(isAtEnrollmentCapacity(14)).toBe(false);
    expect(isAtEnrollmentCapacity(15)).toBe(true);
  });

  it('keeps STUDENT read-only in the UX gate', () => {
    const roles: Role[] = [
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
      'STUDENT',
    ];
    expect(roles.filter((role) => canMutateAcademicStructureUi(role))).toEqual([
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
    ]);
  });

  it('maps common mutation HTTP errors', () => {
    expect(academicMutationErrorMessage(403)).toMatch(/permiso/i);
    expect(academicMutationErrorMessage(404, 'assignment')).toMatch(/asignación/i);
    expect(academicMutationErrorMessage(400, 'enrollment')).toMatch(/15/);
    expect(academicMutationErrorMessage(409, 'enrollment')).toMatch(/15/);
    expect(academicMutationErrorMessage(400)).toMatch(/datos/i);
  });
});
