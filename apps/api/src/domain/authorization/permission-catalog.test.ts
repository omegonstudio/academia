import { describe, expect, it } from 'vitest';
import {
  isCatalogPermission,
  PERMISSION_ACTIONS,
  PERMISSION_CATALOG,
  PERMISSION_MODULES,
  permissionActionSchema,
  permissionModuleSchema,
} from '@academia/shared';

describe('PERMISSION_CATALOG', () => {
  it('uses only declared modules and actions', () => {
    for (const entry of PERMISSION_CATALOG) {
      expect(PERMISSION_MODULES).toContain(entry.module);
      expect(PERMISSION_ACTIONS).toContain(entry.action);
      expect(permissionModuleSchema.safeParse(entry.module).success).toBe(true);
      expect(permissionActionSchema.safeParse(entry.action).success).toBe(true);
    }
  });

  it('omits permissions.create and rejects unknown pairs', () => {
    expect(isCatalogPermission('permissions', 'create')).toBe(false);
    expect(isCatalogPermission('students', 'read')).toBe(true);
    expect(isCatalogPermission('students', 'delete')).toBe(true);
    expect(isCatalogPermission('teachers', 'delete')).toBe(true);
    expect(isCatalogPermission('courses', 'read')).toBe(true);
    expect(isCatalogPermission('groups', 'delete')).toBe(true);
    expect(isCatalogPermission('schedules', 'read')).toBe(true);
    expect(isCatalogPermission('classes', 'delete')).toBe(true);
    expect(isCatalogPermission('students', 'archive')).toBe(false);
  });
});
