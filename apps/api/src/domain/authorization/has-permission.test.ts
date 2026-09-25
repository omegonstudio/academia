import { describe, expect, it, vi } from 'vitest';
import type { PermissionGrantStore } from './has-permission.js';
import { hasPermission } from './has-permission.js';

function createStore(owns: boolean): PermissionGrantStore {
  return {
    roleOwns: vi.fn(async () => owns),
  };
}

describe('hasPermission', () => {
  it('allows SUPER_ADMIN for every catalog permission without consulting grants', async () => {
    const store = createStore(false);

    await expect(
      hasPermission(store, 'SUPER_ADMIN', 'students', 'read'),
    ).resolves.toBe(true);
    await expect(
      hasPermission(store, 'SUPER_ADMIN', 'permissions', 'update'),
    ).resolves.toBe(true);
    expect(store.roleOwns).not.toHaveBeenCalled();
  });

  it('allows DIRECTOR for every catalog permission without consulting grants', async () => {
    const store = createStore(false);

    await expect(
      hasPermission(store, 'DIRECTOR', 'finance', 'create'),
    ).resolves.toBe(true);
    expect(store.roleOwns).not.toHaveBeenCalled();
  });

  it('denies ADMINISTRATIVE when no grant exists', async () => {
    const store = createStore(false);

    await expect(
      hasPermission(store, 'ADMINISTRATIVE', 'students', 'read'),
    ).resolves.toBe(false);
    expect(store.roleOwns).toHaveBeenCalledWith(
      'ADMINISTRATIVE',
      'students',
      'read',
    );
  });

  it('allows ADMINISTRATIVE when a grant exists', async () => {
    const store = createStore(true);

    await expect(
      hasPermission(store, 'ADMINISTRATIVE', 'students', 'update'),
    ).resolves.toBe(true);
  });

  it('denies TEACHER and STUDENT without a grant', async () => {
    const store = createStore(false);

    await expect(
      hasPermission(store, 'TEACHER', 'classes', 'read'),
    ).resolves.toBe(false);
    await expect(
      hasPermission(store, 'STUDENT', 'materials', 'read'),
    ).resolves.toBe(false);
  });

  it('denies pairs outside the catalog without consulting grants', async () => {
    const store = createStore(true);

    await expect(
      hasPermission(store, 'SUPER_ADMIN', 'students', 'archive'),
    ).resolves.toBe(false);
    await expect(
      hasPermission(store, 'DIRECTOR', 'unknown', 'read'),
    ).resolves.toBe(false);
    await expect(
      hasPermission(store, 'ADMINISTRATIVE', 'permissions', 'create'),
    ).resolves.toBe(false);
    expect(store.roleOwns).not.toHaveBeenCalled();
  });
});
