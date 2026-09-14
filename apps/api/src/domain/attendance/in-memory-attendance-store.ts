import { randomUUID } from 'node:crypto';
import type { AttendanceStatus } from '@academia/shared';
import {
  AttendanceAlreadyExistsError,
  type AttendanceClassSessionRef,
  type AttendanceListFilter,
  type AttendanceRecord,
  type AttendanceStore,
  type AttendanceStudentLookup,
} from './attendance-service.js';

export interface InMemoryAttendanceStore extends AttendanceStore {
  clear(): void;
  seed(record: AttendanceRecord): void;
}

export interface InMemoryAttendanceDeps {
  findClassSession: (
    id: string,
  ) => Promise<AttendanceClassSessionRef | null>;
  findStudent: (id: string) => Promise<AttendanceStudentLookup | null>;
  hasActiveEnrollment: (groupId: string, studentId: string) => Promise<boolean>;
}

export function createInMemoryAttendanceStore(
  deps: InMemoryAttendanceDeps,
): InMemoryAttendanceStore {
  const byKey = new Map<string, AttendanceRecord>();

  function key(classSessionId: string, studentId: string): string {
    return `${classSessionId}:${studentId}`;
  }

  function sortRows(rows: AttendanceRecord[]): AttendanceRecord[] {
    return [...rows].sort((a, b) => {
      const last = a.student.lastName.localeCompare(b.student.lastName);
      if (last !== 0) return last;
      const first = a.student.firstName.localeCompare(b.student.firstName);
      if (first !== 0) return first;
      return a.studentId.localeCompare(b.studentId);
    });
  }

  return {
    clear() {
      byKey.clear();
    },

    seed(record) {
      byKey.set(key(record.classSessionId, record.studentId), {
        ...record,
        student: { ...record.student },
      });
    },

    findClassSession: deps.findClassSession,
    findStudent: deps.findStudent,
    hasActiveEnrollment: deps.hasActiveEnrollment,

    async listByClassSession(
      classSessionId: string,
      filter?: AttendanceListFilter,
    ) {
      const rows = [...byKey.values()].filter((row) => {
        if (row.classSessionId !== classSessionId) return false;
        if (filter?.studentId && row.studentId !== filter.studentId) {
          return false;
        }
        return true;
      });
      return sortRows(rows);
    },

    async findByClassSessionAndStudent(classSessionId, studentId) {
      return byKey.get(key(classSessionId, studentId)) ?? null;
    },

    async create(input: {
      classSessionId: string;
      studentId: string;
      status: AttendanceStatus;
    }) {
      const k = key(input.classSessionId, input.studentId);
      if (byKey.has(k)) {
        throw new AttendanceAlreadyExistsError();
      }
      const student = await deps.findStudent(input.studentId);
      if (!student) {
        throw new Error('Student missing during attendance create.');
      }
      const now = new Date();
      const record: AttendanceRecord = {
        id: randomUUID(),
        classSessionId: input.classSessionId,
        studentId: input.studentId,
        status: input.status,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
        },
        createdAt: now,
        updatedAt: now,
      };
      byKey.set(k, record);
      return { ...record, student: { ...record.student } };
    },

    async updateStatus(classSessionId, studentId, status) {
      const k = key(classSessionId, studentId);
      const existing = byKey.get(k);
      if (!existing) return null;
      const updated: AttendanceRecord = {
        ...existing,
        status,
        updatedAt: new Date(),
        student: { ...existing.student },
      };
      byKey.set(k, updated);
      return updated;
    },
  };
}
