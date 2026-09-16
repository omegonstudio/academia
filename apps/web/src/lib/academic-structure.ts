import {
  COURSE_SERVICE_DURATION_MINUTES,
  GROUP_MAX_ACTIVE_ENROLLMENTS,
  type CourseServiceType,
  type CourseType,
  type Role,
} from '@academia/shared';

export function courseTypeLabel(courseType: CourseType): string {
  switch (courseType) {
    case 'REGULAR':
      return 'Regular';
    case 'TEACHER_TRAINING':
      return 'Formación docente';
    default:
      return courseType;
  }
}

export function courseServiceTypeLabel(serviceType: CourseServiceType): string {
  switch (serviceType) {
    case 'ONE_TO_ONE_60':
      return '1:1 · 60 min';
    case 'ONE_TO_ONE_90':
      return '1:1 · 90 min';
    case 'GROUP_120':
      return 'Grupo · 120 min';
    default:
      return serviceType;
  }
}

export function derivedDurationLabel(serviceType: CourseServiceType): string {
  return `${COURSE_SERVICE_DURATION_MINUTES[serviceType]} min`;
}

export function enrollmentCapacityLabel(activeCount: number): string {
  return `${activeCount} / ${GROUP_MAX_ACTIVE_ENROLLMENTS}`;
}

export function isAtEnrollmentCapacity(activeCount: number): boolean {
  return activeCount >= GROUP_MAX_ACTIVE_ENROLLMENTS;
}

/** UX gate only — API remains the security boundary. */
export function canMutateAcademicStructureUi(role: Role): boolean {
  return role !== 'STUDENT';
}

export function academicMutationErrorMessage(
  status: number,
  context:
    | 'course'
    | 'group'
    | 'assignment'
    | 'group-teacher'
    | 'enrollment'
    | 'schedule' = 'course',
): string {
  if (status === 403) {
    return 'No tenés permiso para esta acción.';
  }
  if (status === 404) {
    switch (context) {
      case 'assignment':
        return 'No hay asignación actual o no se encontró el recurso.';
      case 'group-teacher':
        return 'No hay docente asignado al grupo o no se encontró el recurso.';
      case 'enrollment':
        return 'No se encontró el grupo o el estudiante.';
      default:
        return 'No encontramos el recurso.';
    }
  }
  if (status === 409) {
    if (context === 'enrollment') {
      return 'El grupo alcanzó el máximo de 15 estudiantes activos.';
    }
    return 'Hay un conflicto con el estado actual.';
  }
  if (status === 400) {
    if (context === 'enrollment') {
      return 'No se pudo inscribir. El grupo puede estar completo (máx. 15) o el estudiante no es válido.';
    }
    return 'Revisá los datos e intentá de nuevo.';
  }
  return 'No pudimos completar la operación. Intentá de nuevo.';
}
