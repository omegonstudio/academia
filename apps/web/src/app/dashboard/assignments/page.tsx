import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { StudentAssignmentRow } from '@/components/student-assignment-row';
import { canMutateAcademicStructureUi } from '@/lib/academic-structure';
import {
  fetchStudentTeacherAssignment,
  fetchStudents,
  fetchTeachers,
  getSession,
} from '@/lib/api';

export const metadata: Metadata = {
  title: 'Asignaciones',
  robots: { index: false, follow: false },
};

export default async function AssignmentsPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const canWrite = canMutateAcademicStructureUi(user.role);

  const [studentsResult, teachersResult] = await Promise.all([
    fetchStudents(),
    fetchTeachers(),
  ]);

  if (!studentsResult.ok) {
    return (
      <>
        <PageHeader
          title="Asignaciones"
          intro="Docente actual de cada estudiante (sin historial)."
        />
        <p role="alert" className="text-sm text-danger">
          {studentsResult.message}
        </p>
        <p className="mt-8 text-sm text-ink-muted">
          <Link href="/dashboard" className="underline">
            Volver al panel
          </Link>
        </p>
      </>
    );
  }

  const activeStudents = studentsResult.students.filter(
    (student) => student.isActive,
  );

  const assignmentResults = await Promise.all(
    activeStudents.map(async (student) => {
      const result = await fetchStudentTeacherAssignment(student.id);
      if (result.ok) {
        return { student, teacherId: result.assignment.teacherId };
      }
      return { student, teacherId: null as string | null };
    }),
  );

  const teachersById = new Map(
    teachersResult.ok
      ? teachersResult.teachers.map((teacher) => [teacher.id, teacher] as const)
      : [],
  );

  return (
    <>
      <PageHeader
        title="Asignaciones"
        intro="Docente actual de cada estudiante (sin historial)."
      />

      {!teachersResult.ok ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {teachersResult.message}
        </p>
      ) : null}

      {activeStudents.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No hay estudiantes activos para asignar.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {assignmentResults.map((row) => (
            <StudentAssignmentRow
              key={row.student.id}
              studentId={row.student.id}
              studentName={`${row.student.lastName}, ${row.student.firstName}`}
              teacherId={row.teacherId}
              teachers={teachersById}
              canWrite={canWrite && teachersResult.ok}
            />
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </>
  );
}
