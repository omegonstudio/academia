import type { Role } from '@academia/shared';

/**
 * Copy shown on `/dashboard` for each role. Driven by the server-resolved
 * session role — never by client-supplied claims.
 *
 * Deliberately describes the role's place in the product without linking to
 * modules that do not exist yet.
 */
export interface DashboardRoleContent {
  heading: string;
  summary: string;
  points: readonly string[];
}

const DASHBOARD_BY_ROLE: Record<Role, DashboardRoleContent> = {
  SUPER_ADMIN: {
    heading: 'Control técnico',
    summary:
      'Este panel es el acceso Omegon a la plataforma: identidad, operación técnica y supervisión del sistema.',
    points: [
      'Podés aprovisionar dirección y revisar el estado de la academia desde la API.',
      'Los módulos operativos de la academia se habilitarán en etapas posteriores.',
      'No hay acciones inventadas aquí: solo la sesión real y el alcance de este rol.',
    ],
  },
  DIRECTOR: {
    heading: 'Dirección de la academia',
    summary:
      'Este panel es el espacio de quien opera la academia: personal, permisos administrativos y, más adelante, la operación completa.',
    points: [
      'Desde la API ya podés aprovisionar personal y gestionar permisos del rol administrativo.',
      'Los paneles de estudiantes, docentes, clases y finanzas llegarán en etapas siguientes.',
      'Mientras tanto, este espacio confirma tu sesión como dirección.',
    ],
  },
  ADMINISTRATIVE: {
    heading: 'Administración operativa',
    summary:
      'Este panel es para personal administrativo cuyas capacidades las define la dirección mediante permisos.',
    points: [
      'Lo que podrás hacer en la plataforma depende de los permisos que te asigne la dirección.',
      'Los módulos operativos (personas, clases, finanzas) aún no están en esta pantalla.',
      'Cuando existan, solo verás acciones respaldadas por permisos reales en el servidor.',
    ],
  },
  TEACHER: {
    heading: 'Espacio docente',
    summary:
      'Este panel es el punto de entrada del cuerpo docente: clases, materiales y estudiantes asignados llegarán más adelante.',
    points: [
      'Tu rol de docente está activo en la sesión.',
      'No podés aprovisionar estudiantes ni asignarte alumnado desde aquí.',
      'Las herramientas de clase y materiales se publicarán cuando el backend correspondiente exista.',
    ],
  },
  STUDENT: {
    heading: 'Espacio del estudiante',
    summary:
      'Este panel es tu acceso como estudiante: clases, materiales y progreso se mostrarán cuando esos módulos existan.',
    points: [
      'Tu sesión confirma el rol de estudiante.',
      'Solo verás información propia cuando esos datos estén disponibles en el servidor.',
      'No hay acciones de gestión académica en esta pantalla todavía.',
    ],
  },
};

export function dashboardContentForRole(role: Role): DashboardRoleContent {
  return DASHBOARD_BY_ROLE[role];
}
