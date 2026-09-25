import type { PermissionAction, PermissionModule, Role } from '@academia/shared';

/**
 * UX gates for Stage 1 identity surfaces.
 * API (`requirePermission` / role gates) remains the security boundary.
 */
export function canManageAdministrativePermissionsUi(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'DIRECTOR';
}

export function canProvisionAdministrativeUi(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'DIRECTOR';
}

/** Settings page is available to every authenticated role (session info). */
export function canViewSettingsUi(_role: Role): boolean {
  return true;
}

export function permissionModuleLabel(module: PermissionModule): string {
  switch (module) {
    case 'students':
      return 'Estudiantes';
    case 'teachers':
      return 'Profesores';
    case 'assignments':
      return 'Asignaciones';
    case 'courses':
      return 'Cursos';
    case 'groups':
      return 'Grupos';
    case 'schedules':
      return 'Horarios';
    case 'classes':
      return 'Clases';
    case 'materials':
      return 'Materiales';
    case 'finance':
      return 'Finanzas';
    case 'users':
      return 'Usuarios';
    case 'permissions':
      return 'Permisos';
    default:
      return module;
  }
}

export function permissionActionLabel(action: PermissionAction): string {
  switch (action) {
    case 'read':
      return 'Leer';
    case 'create':
      return 'Crear';
    case 'update':
      return 'Actualizar';
    case 'delete':
      return 'Eliminar';
    default:
      return action;
  }
}

export function permissionKey(
  module: PermissionModule,
  action: PermissionAction,
): string {
  return `${module}:${action}`;
}

export function identityMutationErrorMessage(
  status: number,
  context: 'administrative' | 'permission' = 'administrative',
): string {
  if (status === 403) {
    return context === 'permission'
      ? 'No tenés permiso para gestionar permisos administrativos.'
      : 'No tenés permiso para aprovisionar personal administrativo.';
  }
  if (status === 409) {
    return 'Ese correo ya pertenece a otro rol.';
  }
  if (status === 401) {
    return 'Tu sesión expiró. Volvé a iniciar sesión.';
  }
  if (status === 400) {
    return 'Revisá los datos e intentá de nuevo.';
  }
  return 'No pudimos completar la operación.';
}
