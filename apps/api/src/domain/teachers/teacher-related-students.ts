import {
  isCourseServiceType,
  type TeacherHubStudent,
} from '@academia/shared';

/**
 * Students related to a teacher via TeacherAssignment and/or Enrollment
 * in groups they teach. Session identity supplies teacherId — never the client.
 */

export interface TeacherRelatedStudentRaw {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  level: string;
  isActive: boolean;
  viaAssignment: boolean;
  groups: Array<{
    id: string;
    name: string;
    course: {
      id: string;
      name: string;
      serviceType: string;
    };
  }>;
}

export interface TeacherRelatedStudentsStore {
  listRelatedStudents(teacherId: string): Promise<TeacherRelatedStudentRaw[]>;
}

export function toTeacherHubStudentDto(
  row: TeacherRelatedStudentRaw,
): TeacherHubStudent {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    level: row.level,
    isActive: row.isActive,
    viaAssignment: row.viaAssignment,
    groups: row.groups.map((group) => {
      if (!isCourseServiceType(group.course.serviceType)) {
        throw new Error(
          `Invalid course serviceType: ${group.course.serviceType}`,
        );
      }
      return {
        id: group.id,
        name: group.name,
        course: {
          id: group.course.id,
          name: group.course.name,
          serviceType: group.course.serviceType,
        },
      };
    }),
  };
}

export async function listRelatedStudentsForTeacher(
  store: TeacherRelatedStudentsStore,
  teacherId: string,
): Promise<TeacherHubStudent[]> {
  const rows = await store.listRelatedStudents(teacherId);
  return rows
    .map(toTeacherHubStudentDto)
    .sort((a, b) => {
      const last = a.lastName.localeCompare(b.lastName, 'es');
      if (last !== 0) return last;
      return a.firstName.localeCompare(b.firstName, 'es');
    });
}
