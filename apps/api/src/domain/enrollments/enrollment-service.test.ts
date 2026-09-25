import { describe, expect, it } from 'vitest';
import { GROUP_MAX_ACTIVE_ENROLLMENTS } from '@academia/shared';
import {
  enrollStudentInGroup,
  EnrollmentValidationError,
  listGroupEnrollments,
  unenrollStudentFromGroup,
  type EnrollmentGroupRef,
  type EnrollmentStudentRef,
} from './enrollment-service.js';
import { createInMemoryEnrollmentStore } from './in-memory-enrollment-store.js';

describe('enrollment-service', () => {
  function setup() {
    const groups = new Map<string, EnrollmentGroupRef>([
      ['group-1', { id: 'group-1', isActive: true }],
    ]);
    const students = new Map<string, EnrollmentStudentRef>();

    const enrollments = createInMemoryEnrollmentStore({
      findGroup: async (id) => groups.get(id) ?? null,
      findStudent: async (id) => students.get(id) ?? null,
    });

    function addStudent(id: string, isActive = true): void {
      students.set(id, { id, isActive });
    }

    return { groups, students, enrollments, addStudent };
  }

  it('enrolls, lists and unenrolls a student', async () => {
    const { enrollments, addStudent } = setup();
    addStudent('student-1');

    const enrollment = await enrollStudentInGroup(enrollments, 'group-1', {
      studentId: 'student-1',
    });
    expect(enrollment.studentId).toBe('student-1');
    expect(enrollment.isActive).toBe(true);

    expect(await listGroupEnrollments(enrollments, 'group-1')).toHaveLength(1);

    await unenrollStudentFromGroup(enrollments, 'group-1', 'student-1');
    expect(await listGroupEnrollments(enrollments, 'group-1')).toHaveLength(0);
  });

  it('allows the 15th enrollment and rejects the 16th', async () => {
    const { enrollments, addStudent } = setup();

    for (let i = 0; i < GROUP_MAX_ACTIVE_ENROLLMENTS; i += 1) {
      const id = `student-${i}`;
      addStudent(id);
      await enrollStudentInGroup(enrollments, 'group-1', { studentId: id });
    }

    expect(await listGroupEnrollments(enrollments, 'group-1')).toHaveLength(15);

    addStudent('student-overflow');
    await expect(
      enrollStudentInGroup(enrollments, 'group-1', {
        studentId: 'student-overflow',
      }),
    ).rejects.toBeInstanceOf(EnrollmentValidationError);
    await expect(
      enrollStudentInGroup(enrollments, 'group-1', {
        studentId: 'student-overflow',
      }),
    ).rejects.toThrow(/full/);
  });

  it('rejects duplicate active enrollment', async () => {
    const { enrollments, addStudent } = setup();
    addStudent('student-1');
    await enrollStudentInGroup(enrollments, 'group-1', {
      studentId: 'student-1',
    });
    await expect(
      enrollStudentInGroup(enrollments, 'group-1', {
        studentId: 'student-1',
      }),
    ).rejects.toThrow(/already enrolled/);
  });

  it('rejects inactive student and inactive group', async () => {
    const { enrollments, addStudent, groups } = setup();
    addStudent('student-inactive', false);
    await expect(
      enrollStudentInGroup(enrollments, 'group-1', {
        studentId: 'student-inactive',
      }),
    ).rejects.toThrow(/Student is inactive/);

    addStudent('student-ok');
    groups.set('group-1', { id: 'group-1', isActive: false });
    await expect(
      enrollStudentInGroup(enrollments, 'group-1', {
        studentId: 'student-ok',
      }),
    ).rejects.toThrow(/Group is inactive/);
  });
});
