import type { Database } from '../../lib/prisma.js';
import type { PermissionChangeAuditStore } from './permission-change-audit.js';

/** Prisma-backed append-only permission change audit. */
export function createPermissionChangeAuditStore(
  database: Database,
): PermissionChangeAuditStore {
  return {
    async append(entry) {
      await database.permissionChangeAudit.create({
        data: {
          actorUserId: entry.actorUserId,
          targetRole: entry.targetRole,
          changeType: entry.changeType,
          module: entry.module,
          action: entry.action,
          outcome: entry.outcome,
        },
      });
    },
  };
}
