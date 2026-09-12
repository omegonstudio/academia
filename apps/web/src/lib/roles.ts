import type { Role } from '@academia/shared';

/** Spanish labels for the roles, used wherever a role is shown to a person. */
const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Administración técnica',
  DIRECTOR: 'Dirección',
  ADMINISTRATIVE: 'Administración',
  TEACHER: 'Docente',
  STUDENT: 'Estudiante',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
