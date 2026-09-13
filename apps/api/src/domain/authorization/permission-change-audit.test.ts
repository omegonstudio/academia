import { describe, expect, it, vi } from 'vitest';
import {
  recordPermissionChange,
  type PermissionChangeAuditStore,
} from './permission-change-audit.js';

describe('recordPermissionChange', () => {
  it('appends the entry to the store', async () => {
    const store: PermissionChangeAuditStore = {
      append: vi.fn(async () => undefined),
    };

    await recordPermissionChange(store, {
      actorUserId: 'actor-1',
      targetRole: 'ADMINISTRATIVE',
      changeType: 'GRANT',
      module: 'students',
      action: 'read',
      outcome: 'created',
    });

    expect(store.append).toHaveBeenCalledWith({
      actorUserId: 'actor-1',
      targetRole: 'ADMINISTRATIVE',
      changeType: 'GRANT',
      module: 'students',
      action: 'read',
      outcome: 'created',
    });
  });
});
