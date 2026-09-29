import type {
  TeacherRelatedStudentRaw,
  TeacherRelatedStudentsStore,
} from './teacher-related-students.js';

export interface InMemoryTeacherRelatedStudentsStore
  extends TeacherRelatedStudentsStore {
  clear(): void;
  seed(teacherId: string, student: TeacherRelatedStudentRaw): void;
}

export function createInMemoryTeacherRelatedStudentsStore(): InMemoryTeacherRelatedStudentsStore {
  /** teacherId → students */
  const byTeacher = new Map<string, Map<string, TeacherRelatedStudentRaw>>();

  return {
    clear() {
      byTeacher.clear();
    },

    seed(teacherId, student) {
      let bucket = byTeacher.get(teacherId);
      if (!bucket) {
        bucket = new Map();
        byTeacher.set(teacherId, bucket);
      }
      const existing = bucket.get(student.id);
      if (existing) {
        bucket.set(student.id, {
          ...existing,
          viaAssignment: existing.viaAssignment || student.viaAssignment,
          groups: mergeGroups(existing.groups, student.groups),
        });
      } else {
        bucket.set(student.id, {
          ...student,
          groups: student.groups.map((g) => ({
            ...g,
            course: { ...g.course },
          })),
        });
      }
    },

    async listRelatedStudents(teacherId) {
      const bucket = byTeacher.get(teacherId);
      if (!bucket) return [];
      return [...bucket.values()].map((row) => ({
        ...row,
        groups: row.groups.map((g) => ({
          ...g,
          course: { ...g.course },
        })),
      }));
    },
  };
}

function mergeGroups(
  a: TeacherRelatedStudentRaw['groups'],
  b: TeacherRelatedStudentRaw['groups'],
): TeacherRelatedStudentRaw['groups'] {
  const byId = new Map(a.map((g) => [g.id, { ...g, course: { ...g.course } }]));
  for (const g of b) {
    if (!byId.has(g.id)) {
      byId.set(g.id, { ...g, course: { ...g.course } });
    }
  }
  return [...byId.values()];
}
