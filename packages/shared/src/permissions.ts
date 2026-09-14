import { z } from 'zod';

/**
 * Academy permission modules. Keep in sync with Permission rows seeded by
 * migration and with MASTER-PROMPT authorization matrix.
 */
export const PERMISSION_MODULES = [
  'students',
  'teachers',
  'assignments',
  'courses',
  'groups',
  'schedules',
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
export const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete'] as const;

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
  { module: 'students', action: 'delete' },
  { module: 'teachers', action: 'read' },
  { module: 'teachers', action: 'create' },
  { module: 'teachers', action: 'update' },
  { module: 'teachers', action: 'delete' },
  { module: 'assignments', action: 'read' },
  { module: 'assignments', action: 'create' },
  { module: 'assignments', action: 'update' },
  { module: 'courses', action: 'read' },
  { module: 'courses', action: 'create' },
  { module: 'courses', action: 'update' },
  { module: 'courses', action: 'delete' },
  { module: 'groups', action: 'read' },
  { module: 'groups', action: 'create' },
  { module: 'groups', action: 'update' },
  { module: 'groups', action: 'delete' },
  { module: 'schedules', action: 'read' },
  { module: 'schedules', action: 'create' },
  { module: 'schedules', action: 'update' },
  { module: 'schedules', action: 'delete' },
  { module: 'classes', action: 'read' },
  { module: 'classes', action: 'create' },
  { module: 'classes', action: 'update' },
  { module: 'classes', action: 'delete' },
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

export const permissionRefSchema = z
  .object({
    module: permissionModuleSchema,
    action: permissionActionSchema,
  })
  .refine(
    (value) => isCatalogPermission(value.module, value.action),
    { message: 'Permission is not in the catalog.' },
  );

export type PermissionRefInput = z.infer<typeof permissionRefSchema>;

/** Body for grant/revoke of a single catalog permission. */
export const managePermissionRequestSchema = permissionRefSchema;

export type ManagePermissionRequest = PermissionRefInput;

export const permissionListResponseSchema = z.object({
  permissions: z.array(
    z.object({
      module: permissionModuleSchema,
      action: permissionActionSchema,
    }),
  ),
});

export type PermissionListResponse = z.infer<typeof permissionListResponseSchema>;

export const permissionMutationResponseSchema = z.object({
  permission: z.object({
    module: permissionModuleSchema,
    action: permissionActionSchema,
  }),
});

export type PermissionMutationResponse = z.infer<
  typeof permissionMutationResponseSchema
>;
