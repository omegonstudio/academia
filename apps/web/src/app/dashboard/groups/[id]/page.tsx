import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GroupDetailActions } from '@/components/group-detail-actions';
import { GroupEnrollmentPanel } from '@/components/group-enrollment-panel';
import { GroupTeacherPanel } from '@/components/group-teacher-panel';
import { PageHeader } from '@/components/page-header';
import {
  canMutateAcademicStructureUi,
  courseServiceTypeLabel,
  courseTypeLabel,
} from '@/lib/academic-structure';
import {
  fetchCourse,
  fetchGroup,
  fetchGroupEnrollments,
  fetchGroupTeacher,
  fetchScheduleOptions,
  fetchStudents,
  fetchTeachers,
  getSession,
} from '@/lib/api';

export const metadata: Metadata = {
  title: 'Grupo',
  robots: { index: false, follow: false },
};

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const { id } = await params;
  const groupResult = await fetchGroup(id);
  const canWrite = canMutateAcademicStructureUi(user.role);

  if (!groupResult.ok) {
    return (
      <>
        <PageHeader title="Grupo" />
        <p role="alert" className="text-sm text-danger">
          {groupResult.message}
        </p>
        <p className="mt-6 text-sm">
          <Link href="/dashboard/groups" className="underline">
            Volver al listado
          </Link>
        </p>
      </>
    );
  }

  const { group } = groupResult;

  const [
    courseResult,
    scheduleResult,
    teachersResult,
    studentsResult,
    enrollmentsResult,
    groupTeacherResult,
  ] = await Promise.all([
    fetchCourse(group.courseId),
    fetchScheduleOptions(),
    fetchTeachers(),
    fetchStudents(),
    fetchGroupEnrollments(group.id),
    fetchGroupTeacher(group.id),
  ]);

  const teacherId =
    group.teacherId ??
    (groupTeacherResult.ok ? groupTeacherResult.teacherId : null);

  const teachers = teachersResult.ok ? teachersResult.teachers : [];
  const teacher = teacherId
    ? teachers.find((row) => row.id === teacherId) ?? null
    : null;

  const scheduleOptions = scheduleResult.ok
    ? scheduleResult.scheduleOptions
    : [];
  const currentSchedule = group.scheduleOptionId
    ? scheduleOptions.find((option) => option.id === group.scheduleOptionId)
    : null;

  const studentsById = new Map(
    studentsResult.ok
      ? studentsResult.students.map((student) => [student.id, student] as const)
      : [],
  );

  return (
    <>
      <PageHeader
        title={group.name}
        intro={group.isActive ? 'Grupo activo.' : 'Grupo inactivo.'}
      />

      <dl className="grid max-w-lg gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Estado</dt>
          <dd className="text-ink">{group.isActive ? 'Activo' : 'Inactivo'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Franja</dt>
          <dd className="text-right text-ink">
            {currentSchedule
              ? currentSchedule.label
              : group.scheduleOptionId
                ? 'Franja no disponible'
                : 'Sin franja'}
          </dd>
        </div>
      </dl>

      <section className="mt-8 max-w-lg" aria-labelledby="linked-course-heading">
        <h2 id="linked-course-heading" className="text-lg font-semibold text-ink">
          Curso vinculado
        </h2>
        {!courseResult.ok ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {courseResult.message}
          </p>
        ) : (
          <dl className="mt-3 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Nombre</dt>
              <dd className="text-ink">
                <Link
                  href={`/dashboard/courses/${courseResult.course.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {courseResult.course.name}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Tipo</dt>
              <dd className="text-ink">
                {courseTypeLabel(courseResult.course.courseType)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Modalidad</dt>
              <dd className="text-ink">
                {courseServiceTypeLabel(courseResult.course.serviceType)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Duración</dt>
              <dd className="text-ink">
                {courseResult.course.durationMinutes} min (derivada)
              </dd>
            </div>
          </dl>
        )}
      </section>

      {canWrite ? (
        <GroupDetailActions
          group={group}
          scheduleOptions={scheduleOptions}
        />
      ) : null}

      {!scheduleResult.ok && canWrite ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {scheduleResult.message}
        </p>
      ) : null}

      <GroupTeacherPanel
        groupId={group.id}
        currentTeacherId={teacherId}
        currentTeacherName={
          teacher
            ? `${teacher.lastName}, ${teacher.firstName}`
            : teacherId
              ? 'Docente no listado'
              : null
        }
        teachers={teachers}
        canWrite={canWrite}
      />

      {!teachersResult.ok && canWrite ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {teachersResult.message}
        </p>
      ) : null}

      {!enrollmentsResult.ok ? (
        <section className="mt-10 max-w-lg" aria-labelledby="enrollment-error">
          <h2 id="enrollment-error" className="text-lg font-semibold text-ink">
            Estudiantes del grupo
          </h2>
          <p role="alert" className="mt-3 text-sm text-danger">
            {enrollmentsResult.message}
          </p>
        </section>
      ) : (
        <GroupEnrollmentPanel
          groupId={group.id}
          enrollments={enrollmentsResult.enrollments}
          students={studentsById}
          canWrite={canWrite}
        />
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard/groups" className="underline">
          Volver al listado
        </Link>
      </p>
    </>
  );
}
