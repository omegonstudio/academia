import type {
  PermissionAction,
  PermissionModule,
  Role,
} from '@academia/shared';
import type { Database } from '../../lib/prisma.js';
import type { PermissionGrantStore } from './has-permission.js';

/** Prisma-backed lookup for RolePermission grants. */
export function createPermissionGrantStore(
  database: Database,
): PermissionGrantStore {
  return {
    async roleOwns(role: Role, module: PermissionModule, action: PermissionAction) {
      const grant = await database.rolePermission.findFirst({
        where: {
          role,
          permission: { module, action },
        },
        select: { id: true },
      });
      return grant !== null;
    },
  };
}
