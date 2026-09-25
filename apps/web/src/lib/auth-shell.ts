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

/**
 * Sidebar sections for the authenticated shell.
 * Permisos / Administrativos only for SUPER_ADMIN and DIRECTOR (UX gate;
 * API remains the authority).
 */
export function dashboardNavSections(role: Role): ShellNavSection[] {
  const sections: ShellNavSection[] = [
    { title: 'Academia', links: ACADEMIA_LINKS },
    { title: 'Clases', links: CLASS_LINKS },
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
