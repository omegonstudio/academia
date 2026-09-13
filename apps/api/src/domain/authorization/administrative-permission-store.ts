import type {
  PermissionAction,
  PermissionModule,
  PermissionRef,
} from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import type { AdministrativePermissionStore } from './manage-administrative-permissions.js';

const TARGET_ROLE = 'ADMINISTRATIVE' as const;

/** Prisma-backed ADMINISTRATIVE grant mutations and listing. */
export function createAdministrativePermissionStore(
  database: Database,
): AdministrativePermissionStore {
  return {
    async listGranted() {
      const rows = await database.rolePermission.findMany({
        where: { role: TARGET_ROLE },
        select: {
          permission: { select: { module: true, action: true } },
        },
        orderBy: [
          { permission: { module: 'asc' } },
          { permission: { action: 'asc' } },
        ],
      });

      return rows.map(
        (row): PermissionRef => ({
          module: row.permission.module as PermissionModule,
          action: row.permission.action as PermissionAction,
        }),
      );
    },

    async grant(module, action) {
      const permission = await database.permission.findUnique({
        where: { module_action: { module, action } },
        select: { id: true },
      });
      if (!permission) {
        throw new Error(
          `Catalog row missing for ${module}.${action}; run migrations.`,
        );
      }

      const existing = await database.rolePermission.findUnique({
        where: {
          role_permissionId: {
            role: TARGET_ROLE,
            permissionId: permission.id,
          },
        },
        select: { id: true },
      });
      if (existing) {
        return 'exists';
      }

      await database.rolePermission.create({
        data: {
          role: TARGET_ROLE,
          permissionId: permission.id,
        },
      });
      return 'created';
    },

    async revoke(module, action) {
      const permission = await database.permission.findUnique({
        where: { module_action: { module, action } },
        select: { id: true },
      });
      if (!permission) {
        throw new Error(
          `Catalog row missing for ${module}.${action}; run migrations.`,
        );
      }

      const result = await database.rolePermission.deleteMany({
        where: {
          role: TARGET_ROLE,
          permissionId: permission.id,
        },
      });
      return result.count > 0 ? 'removed' : 'missing';
    },
  };
}
