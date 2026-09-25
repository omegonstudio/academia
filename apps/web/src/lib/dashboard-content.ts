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
      'Podés aprovisionar dirección y administrativos, y revisar permisos desde el panel.',
      'Desde el menú del panel podés abrir personas, clases, calendario y configuración de sesión.',
      'No hay acciones inventadas aquí: solo la sesión real y el alcance de este rol.',
    ],
  },
  DIRECTOR: {
    heading: 'Dirección de la academia',
    summary:
      'Este panel es el espacio de quien opera la academia: personal, clases, permisos administrativos y, más adelante, finanzas.',
    points: [
      'Podés aprovisionar administrativos y gestionar sus permisos desde el panel.',
      'Estudiantes, profesores, clases y calendario están disponibles vía API real.',
      'La configuración financiera (porcentaje de la academia, pagos) llega en etapas posteriores.',
    ],
  },
  ADMINISTRATIVE: {
    heading: 'Administración operativa',
    summary:
      'Este panel es para personal administrativo cuyas capacidades las define la dirección mediante permisos.',
    points: [
      'Lo que podrás hacer en la plataforma depende de los permisos que te asigne la dirección.',
      'Si tenés grants, personas, clases y calendario responden con datos reales del servidor.',
      'Solo verás acciones respaldadas por permisos u ownership reales en el backend.',
    ],
  },
  TEACHER: {
    heading: 'Espacio docente',
    summary:
      'Este panel es el punto de entrada del cuerpo docente: tus clases, calendario y, más adelante, materiales y finanzas.',
    points: [
      'Tu rol de docente está activo en la sesión.',
      'Clases y calendario muestran solo las de tus grupos (ownership en el servidor).',
      'No podés aprovisionar estudiantes ni asignarte alumnado desde aquí.',
    ],
  },
  STUDENT: {
    heading: 'Espacio del estudiante',
    summary:
      'Este panel es tu acceso como estudiante: tus clases, calendario y, más adelante, materiales y progreso.',
    points: [
      'Tu sesión confirma el rol de estudiante.',
      'Clases y calendario muestran solo grupos donde tenés enrollment activo.',
      'Solo ves información propia cuando el servidor te autoriza.',
    ],
  },
};

export function dashboardContentForRole(role: Role): DashboardRoleContent {
  return DASHBOARD_BY_ROLE[role];
}
