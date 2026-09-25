import type {
  AssignmentParticipant,
  AssignmentRecord,
  TeacherAssignmentStore,
} from './assignment-service.js';

export interface InMemoryTeacherAssignmentStore extends TeacherAssignmentStore {
  clear(): void;
  seedStudent(participant: AssignmentParticipant): void;
  seedTeacher(participant: AssignmentParticipant): void;
  setStudentActive(id: string, isActive: boolean): void;
  setTeacherActive(id: string, isActive: boolean): void;
}

export function createInMemoryTeacherAssignmentStore(): InMemoryTeacherAssignmentStore {
  const byStudentId = new Map<string, AssignmentRecord>();
  const students = new Map<string, AssignmentParticipant>();
  const teachers = new Map<string, AssignmentParticipant>();

  function clone(record: AssignmentRecord): AssignmentRecord {
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  return {
    clear() {
      byStudentId.clear();
      students.clear();
      teachers.clear();
    },

    seedStudent(participant) {
      students.set(participant.id, { ...participant });
    },

    seedTeacher(participant) {
      teachers.set(participant.id, { ...participant });
    },

    setStudentActive(id, isActive) {
      const current = students.get(id);
      if (!current) throw new Error(`student ${id} not found`);
      students.set(id, { ...current, isActive });
    },

    setTeacherActive(id, isActive) {
      const current = teachers.get(id);
      if (!current) throw new Error(`teacher ${id} not found`);
      teachers.set(id, { ...current, isActive });
    },

    async findByStudentId(studentId) {
      const row = byStudentId.get(studentId);
      return row ? clone(row) : null;
    },

    async findStudent(id) {
      const row = students.get(id);
      return row ? { ...row } : null;
    },

    async findTeacher(id) {
      const row = teachers.get(id);
      return row ? { ...row } : null;
    },

    async upsert(studentId, teacherId) {
      const existing = byStudentId.get(studentId);
      const now = new Date();
      const record: AssignmentRecord = {
        studentId,
        teacherId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      byStudentId.set(studentId, record);
      return clone(record);
    },

    async deleteByStudentId(studentId) {
      return byStudentId.delete(studentId);
    },
  };
}
