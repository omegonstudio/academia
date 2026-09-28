import type { Role } from '@academia/shared';
import {
  canManageAdministrativePermissionsUi,
  canProvisionAdministrativeUi,
} from './stage1-identity';

export type ShellNavLink = {
  label: string;
  href: string;
};

export type ShellNavSection = {
  title: string;
  links: readonly ShellNavLink[];
};

const STUDENT_LINKS: readonly ShellNavLink[] = [
  { label: 'Inicio', href: '/dashboard/student' },
  { label: 'Mis clases', href: '/dashboard/student/classes' },
  { label: 'Materiales', href: '/dashboard/student/materials' },
  { label: 'Asistencia', href: '/dashboard/student/attendance' },
  { label: 'Finanzas', href: '/dashboard/student/finance' },
];

const TEACHER_LINKS: readonly ShellNavLink[] = [
  { label: 'Inicio', href: '/dashboard/teacher' },
  { label: 'Mis clases', href: '/dashboard/teacher/classes' },
  { label: 'Mis alumnos', href: '/dashboard/teacher/students' },
  { label: 'Materiales', href: '/dashboard/teacher/materials' },
  { label: 'Asistencia', href: '/dashboard/teacher/attendance' },
  { label: 'Earnings', href: '/dashboard/teacher/earnings' },
];

const ACADEMIA_LINKS: readonly ShellNavLink[] = [
  { label: 'Inicio', href: '/dashboard' },
  { label: 'Estudiantes', href: '/dashboard/students' },
  { label: 'Profesores', href: '/dashboard/teachers' },
  { label: 'Asignaciones', href: '/dashboard/assignments' },
  { label: 'Cursos', href: '/dashboard/courses' },
  { label: 'Grupos', href: '/dashboard/groups' },
];

const CLASS_LINKS: readonly ShellNavLink[] = [
  { label: 'Clases', href: '/dashboard/classes' },
  { label: 'Calendario', href: '/dashboard/calendar' },
];

const FINANCE_LINKS: readonly ShellNavLink[] = [
  { label: 'Finanzas', href: '/dashboard/finance' },
];

/**
 * Sidebar sections for the authenticated shell.
 * STUDENT gets a self-scoped hub; other roles keep operational nav.
 * API remains the authority for authorization.
 */
export function dashboardNavSections(role: Role): ShellNavSection[] {
  if (role === 'STUDENT') {
    return [{ title: 'Mi espacio', links: STUDENT_LINKS }];
  }

  if (role === 'TEACHER') {
    return [{ title: 'Mi espacio', links: TEACHER_LINKS }];
  }

  const sections: ShellNavSection[] = [
    { title: 'Academia', links: ACADEMIA_LINKS },
    { title: 'Clases', links: CLASS_LINKS },
    { title: 'Finanzas', links: FINANCE_LINKS },
  ];

  const adminLinks: ShellNavLink[] = [];
  if (canManageAdministrativePermissionsUi(role)) {
    adminLinks.push({ label: 'Permisos', href: '/dashboard/permissions' });
  }
  if (canProvisionAdministrativeUi(role)) {
    adminLinks.push({
      label: 'Administrativos',
      href: '/dashboard/administratives',
    });
  }
  adminLinks.push({ label: 'Configuración', href: '/dashboard/settings' });

  sections.push({ title: 'Administración', links: adminLinks });
  return sections;
}

/** Safe login error copy — never reveals whether the email exists. */
export function loginErrorMessage(status: number): string {
  if (status === 429) {
    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.';
  }
  return 'El correo o la contraseña no son correctos.';
}

/** Initials for the avatar chip from session name or email. */
export function sessionInitials(user: {
  name: string | null;
  email: string;
}): string {
  const fromName = user.name
    ?.trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  if (fromName && fromName.length > 0) return fromName;
  return user.email.slice(0, 2).toUpperCase();
}

export function sessionDisplayName(user: {
  name: string | null;
  email: string;
}): string {
  const trimmed = user.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : user.email;
}
