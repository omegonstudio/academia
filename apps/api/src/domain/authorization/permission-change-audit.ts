import type {
  PermissionAction,
  PermissionModule,
  Role,
} from '@academia/shared';

export type PermissionChangeKind = 'GRANT' | 'REVOKE';

export interface PermissionChangeAuditEntry {
  actorUserId: string;
  targetRole: Role;
  changeType: PermissionChangeKind;
  module: PermissionModule;
  action: PermissionAction;
  /** Domain outcome from grant/revoke (created | exists | removed | missing). */
  outcome: string;
}

export interface PermissionChangeAuditStore {
  append(entry: PermissionChangeAuditEntry): Promise<void>;
}

/**
 * Persists an append-only audit row for a permission mutation.
 * Failures propagate so the HTTP layer does not report success without a trail.
 */
export async function recordPermissionChange(
  store: PermissionChangeAuditStore,
  entry: PermissionChangeAuditEntry,
): Promise<void> {
  await store.append(entry);
}
