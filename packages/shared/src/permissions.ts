import { z } from 'zod';

/**
 * Academy permission modules. Keep in sync with Permission rows seeded by
 * migration and with MASTER-PROMPT authorization matrix.
 */
export const PERMISSION_MODULES = [
  'students',
  'teachers',
  'assignments',
  'classes',
  'materials',
  'finance',
  'users',
  'permissions',
] as const;

export const permissionModuleSchema = z.enum(PERMISSION_MODULES);
export type PermissionModule = z.infer<typeof permissionModuleSchema>;

/**
 * Actions a module may expose. Not every module uses every action
 * (`permissions` has no `create`).
 */
export const PERMISSION_ACTIONS = ['read', 'create', 'update'] as const;

export const permissionActionSchema = z.enum(PERMISSION_ACTIONS);
export type PermissionAction = z.infer<typeof permissionActionSchema>;

export interface PermissionRef {
  module: PermissionModule;
  action: PermissionAction;
}

/**
 * Canonical catalog of (module, action) pairs.
 *
 * Source of truth for what may be granted via RolePermission. SUPER_ADMIN and
 * DIRECTOR bypass the grant table in domain logic; ADMINISTRATIVE relies on it.
 */
export const PERMISSION_CATALOG: readonly PermissionRef[] = [
  { module: 'students', action: 'read' },
  { module: 'students', action: 'create' },
  { module: 'students', action: 'update' },
  { module: 'teachers', action: 'read' },
  { module: 'teachers', action: 'create' },
  { module: 'teachers', action: 'update' },
  { module: 'assignments', action: 'read' },
  { module: 'assignments', action: 'create' },
  { module: 'assignments', action: 'update' },
  { module: 'classes', action: 'read' },
  { module: 'classes', action: 'create' },
  { module: 'classes', action: 'update' },
  { module: 'materials', action: 'read' },
  { module: 'materials', action: 'create' },
  { module: 'materials', action: 'update' },
  { module: 'finance', action: 'read' },
  { module: 'finance', action: 'create' },
  { module: 'finance', action: 'update' },
  { module: 'users', action: 'read' },
  { module: 'users', action: 'create' },
  { module: 'users', action: 'update' },
  { module: 'permissions', action: 'read' },
  { module: 'permissions', action: 'update' },
] as const;

export function isPermissionModule(value: unknown): value is PermissionModule {
  return permissionModuleSchema.safeParse(value).success;
}

export function isPermissionAction(value: unknown): value is PermissionAction {
  return permissionActionSchema.safeParse(value).success;
}

export function isCatalogPermission(module: string, action: string): boolean {
  return PERMISSION_CATALOG.some(
    (entry) => entry.module === module && entry.action === action,
  );
}
