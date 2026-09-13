import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG } from '@academia/shared';
import { createAdministrativePermissionStore } from '../domain/authorization/administrative-permission-store.js';
import { hasPermission } from '../domain/authorization/has-permission.js';
import {
  grantAdministrativePermission,
  listAdministrativePermissions,
  revokeAdministrativePermission,
  UnknownPermissionError,
} from '../domain/authorization/manage-administrative-permissions.js';
import { createPermissionGrantStore } from '../domain/authorization/permission-grant-store.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';

/**
 * Exercises Permission / RolePermission persistence and hasPermission against
 * a real PostgreSQL with the catalog migration applied.
 */
const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

describe('permissions integration', () => {
  let database: Database;

  beforeAll(() => {
    database = createPrismaClient(DATABASE_URL);
  });

  afterAll(async () => {
    await database.rolePermission.deleteMany({
      where: { role: 'ADMINISTRATIVE' },
    });
    await database.$disconnect();
  });

  beforeEach(async () => {
    await database.rolePermission.deleteMany({
      where: { role: 'ADMINISTRATIVE' },
    });
  });

  it('seeds the full permission catalog', async () => {
    const rows = await database.permission.findMany({
      select: { module: true, action: true },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    expect(rows).toHaveLength(PERMISSION_CATALOG.length);
    for (const entry of PERMISSION_CATALOG) {
      expect(rows).toContainEqual(entry);
    }
  });

  it('roleOwns is true only when a RolePermission row exists', async () => {
    const store = createPermissionGrantStore(database);
    const permission = await database.permission.findFirstOrThrow({
      where: { module: 'students', action: 'read' },
    });

    await expect(
      store.roleOwns('ADMINISTRATIVE', 'students', 'read'),
    ).resolves.toBe(false);

    await database.rolePermission.create({
      data: {
        role: 'ADMINISTRATIVE',
        permissionId: permission.id,
      },
    });

    await expect(
      store.roleOwns('ADMINISTRATIVE', 'students', 'read'),
    ).resolves.toBe(true);
    await expect(
      store.roleOwns('ADMINISTRATIVE', 'students', 'create'),
    ).resolves.toBe(false);
  });

  it('hasPermission respects grants for ADMINISTRATIVE and bypass for DIRECTOR', async () => {
    const store = createPermissionGrantStore(database);
    const permission = await database.permission.findFirstOrThrow({
      where: { module: 'finance', action: 'read' },
    });

    await expect(
      hasPermission(store, 'ADMINISTRATIVE', 'finance', 'read'),
    ).resolves.toBe(false);
    await expect(
      hasPermission(store, 'DIRECTOR', 'finance', 'read'),
    ).resolves.toBe(true);

    await database.rolePermission.create({
      data: {
        role: 'ADMINISTRATIVE',
        permissionId: permission.id,
      },
    });

    await expect(
      hasPermission(store, 'ADMINISTRATIVE', 'finance', 'read'),
    ).resolves.toBe(true);
  });

  it('rejects duplicate RolePermission for the same role and permission', async () => {
    const permission = await database.permission.findFirstOrThrow({
      where: { module: 'users', action: 'read' },
    });

    await database.rolePermission.create({
      data: {
        role: 'ADMINISTRATIVE',
        permissionId: permission.id,
      },
    });

    await expect(
      database.rolePermission.create({
        data: {
          role: 'ADMINISTRATIVE',
          permissionId: permission.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('grants, lists and revokes ADMINISTRATIVE permissions idempotently', async () => {
    const store = createAdministrativePermissionStore(database);

    await expect(listAdministrativePermissions(store)).resolves.toEqual([]);

    await expect(
      grantAdministrativePermission(store, 'materials', 'create'),
    ).resolves.toMatchObject({ outcome: 'created' });
    await expect(
      grantAdministrativePermission(store, 'materials', 'create'),
    ).resolves.toMatchObject({ outcome: 'exists' });

    await expect(listAdministrativePermissions(store)).resolves.toEqual([
      { module: 'materials', action: 'create' },
    ]);

    const grantStore = createPermissionGrantStore(database);
    await expect(
      hasPermission(grantStore, 'ADMINISTRATIVE', 'materials', 'create'),
    ).resolves.toBe(true);

    await expect(
      revokeAdministrativePermission(store, 'materials', 'create'),
    ).resolves.toMatchObject({ outcome: 'removed' });
    await expect(
      revokeAdministrativePermission(store, 'materials', 'create'),
    ).resolves.toMatchObject({ outcome: 'missing' });

    await expect(
      hasPermission(grantStore, 'ADMINISTRATIVE', 'materials', 'create'),
    ).resolves.toBe(false);
  });

  it('rejects unknown permissions before touching persistence', async () => {
    const store = createAdministrativePermissionStore(database);

    await expect(
      grantAdministrativePermission(store, 'students', 'delete'),
    ).rejects.toBeInstanceOf(UnknownPermissionError);
  });
});
