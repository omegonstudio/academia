import { describe, expect, it, vi } from 'vitest';
import type {
  AdministrativePermissionStore,
  GrantOutcome,
  RevokeOutcome,
} from './manage-administrative-permissions.js';
import {
  grantAdministrativePermission,
  listAdministrativePermissions,
  revokeAdministrativePermission,
  UnknownPermissionError,
} from './manage-administrative-permissions.js';

function createStore(
  overrides: Partial<AdministrativePermissionStore> = {},
): AdministrativePermissionStore {
  return {
    listGranted: vi.fn(async () => []),
    grant: vi.fn(async (): Promise<GrantOutcome> => 'created'),
    revoke: vi.fn(async (): Promise<RevokeOutcome> => 'removed'),
    ...overrides,
  };
}

describe('manageAdministrativePermissions', () => {
  it('lists grants from the store', async () => {
    const store = createStore({
      listGranted: vi.fn(async () => [
        { module: 'students' as const, action: 'read' as const },
      ]),
    });

    await expect(listAdministrativePermissions(store)).resolves.toEqual([
      { module: 'students', action: 'read' },
    ]);
  });

  it('grants a catalog permission', async () => {
    const store = createStore();

    await expect(
      grantAdministrativePermission(store, 'finance', 'read'),
    ).resolves.toEqual({
      outcome: 'created',
      permission: { module: 'finance', action: 'read' },
    });
    expect(store.grant).toHaveBeenCalledWith('finance', 'read');
  });

  it('rejects grants outside the catalog without calling the store', async () => {
    const store = createStore();

    await expect(
      grantAdministrativePermission(store, 'students', 'archive'),
    ).rejects.toBeInstanceOf(UnknownPermissionError);
    expect(store.grant).not.toHaveBeenCalled();
  });

  it('rejects permissions.create (not in catalog)', async () => {
    const store = createStore();

    await expect(
      grantAdministrativePermission(store, 'permissions', 'create'),
    ).rejects.toBeInstanceOf(UnknownPermissionError);
  });

  it('revokes a catalog permission', async () => {
    const store = createStore({
      revoke: vi.fn(async (): Promise<RevokeOutcome> => 'missing'),
    });

    await expect(
      revokeAdministrativePermission(store, 'users', 'update'),
    ).resolves.toEqual({
      outcome: 'missing',
      permission: { module: 'users', action: 'update' },
    });
    expect(store.revoke).toHaveBeenCalledWith('users', 'update');
  });

  it('rejects revoke outside the catalog', async () => {
    const store = createStore();

    await expect(
      revokeAdministrativePermission(store, 'billing', 'read'),
    ).rejects.toBeInstanceOf(UnknownPermissionError);
    expect(store.revoke).not.toHaveBeenCalled();
  });
});
