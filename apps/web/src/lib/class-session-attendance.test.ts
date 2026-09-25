import { describe, expect, it } from 'vitest';
import type { Attendance, Enrollment, Role } from '@academia/shared';
import {
  attendanceMutationErrorMessage,
  attendanceStatusLabel,
  buildAttendanceRoster,
  canMutateAttendanceUi,
  studentDisplayName,
} from './class-session-attendance.js';

function enrollment(
  studentId: string,
  isActive = true,
): Enrollment {
  return {
    id: `enr-${studentId}`,
    groupId: 'group-1',
    studentId,
    isActive,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  };
}

function attendance(
  studentId: string,
  status: Attendance['status'],
  firstName = 'Ana',
  lastName = 'Perez',
): Attendance {
  return {
    id: `att-${studentId}`,
    classSessionId: 'class-1',
    studentId,
    status,
    student: { id: studentId, firstName, lastName },
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  };
}

describe('buildAttendanceRoster', () => {
  it('merges enrollments with attendance status and names', () => {
    const rows = buildAttendanceRoster({
      enrollments: [enrollment('s-2'), enrollment('s-1')],
      attendances: [attendance('s-1', 'PRESENT', 'Ana', 'Perez')],
    });

    expect(rows).toEqual([
      {
        studentId: 's-1',
        firstName: 'Ana',
        lastName: 'Perez',
        status: 'PRESENT',
      },
      {
        studentId: 's-2',
        firstName: null,
        lastName: null,
        status: null,
      },
    ]);
  });

  it('keeps historical attendance for inactive enrollments', () => {
    const rows = buildAttendanceRoster({
      enrollments: [enrollment('s-1', false)],
      attendances: [attendance('s-1', 'ABSENT')],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('ABSENT');
    expect(rows[0]?.firstName).toBe('Ana');
  });

  it('falls back to attendance-only when enrollments are unavailable', () => {
    const rows = buildAttendanceRoster({
      enrollments: null,
      attendances: [attendance('s-1', 'PRESENT')],
    });

    expect(rows).toEqual([
      {
        studentId: 's-1',
        firstName: 'Ana',
        lastName: 'Perez',
        status: 'PRESENT',
      },
    ]);
  });

  it('renders empty when nothing is available', () => {
    expect(
      buildAttendanceRoster({ enrollments: [], attendances: [] }),
    ).toEqual([]);
    expect(
      buildAttendanceRoster({ enrollments: null, attendances: [] }),
    ).toEqual([]);
  });
});

describe('attendance UI helpers', () => {
  it('labels statuses for display', () => {
    expect(attendanceStatusLabel('PRESENT')).toBe('Presente');
    expect(attendanceStatusLabel('ABSENT')).toBe('Ausente');
    expect(attendanceStatusLabel(null)).toBe('Sin registrar');
  });

  it('formats student names with fallback', () => {
    expect(
      studentDisplayName({
        studentId: 's-1',
        firstName: 'Ana',
        lastName: 'Perez',
        status: null,
      }),
    ).toBe('Perez, Ana');
    expect(
      studentDisplayName({
        studentId: 's-1',
        firstName: null,
        lastName: null,
        status: null,
      }),
    ).toBe('Estudiante');
  });

  it('keeps STUDENT read-only in the UX gate', () => {
    const roles: Role[] = [
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
      'STUDENT',
    ];
    expect(roles.filter((role) => canMutateAttendanceUi(role))).toEqual([
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
    ]);
    expect(canMutateAttendanceUi('STUDENT')).toBe(false);
  });

  it('maps attendance mutation HTTP errors', () => {
    expect(attendanceMutationErrorMessage(400)).toMatch(/inscripto|activa/i);
    expect(attendanceMutationErrorMessage(403)).toMatch(/permiso/i);
    expect(attendanceMutationErrorMessage(404)).toMatch(/encontr/i);
    expect(attendanceMutationErrorMessage(409)).toMatch(/ya estaba/i);
    expect(attendanceMutationErrorMessage(500)).toMatch(/Intentá/i);
  });
});
