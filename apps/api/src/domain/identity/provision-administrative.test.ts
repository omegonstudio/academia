import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../../lib/password.js';
import {
  provisionAdministrative,
  RoleConflictError,
  type AdministrativeIdentityRecord,
  type AdministrativeProvisionStore,
} from './provision-administrative.js';

function createFakeStore(
  seed: Array<AdministrativeIdentityRecord & { passwordHash: string }> = [],
): AdministrativeProvisionStore & {
  hashes: Map<string, string>;
  records: Map<string, AdministrativeIdentityRecord>;
} {
  const records = new Map<string, AdministrativeIdentityRecord>(
    seed.map((row) => {
      const { passwordHash: _passwordHash, ...identity } = row;
      return [row.email, identity];
    }),
  );
  const hashes = new Map(seed.map((row) => [row.email, row.passwordHash]));
  let seq = 0;

  return {
    records,
    hashes,
    async findByEmail(email) {
      return records.get(email) ?? null;
    },
    async create({ email, name, passwordHash }) {
      seq += 1;
      const record: AdministrativeIdentityRecord = {
        id: `id-${seq}`,
        email,
        name,
        role: 'ADMINISTRATIVE',
        isActive: true,
      };
      records.set(email, record);
      hashes.set(email, passwordHash);
      return { ...record };
    },
    async reassertActive(id) {
      for (const [email, record] of records) {
        if (record.id !== id) continue;
        const updated = {
          ...record,
          isActive: true,
          role: 'ADMINISTRATIVE' as const,
        };
        records.set(email, updated);
        return { ...updated };
      }
      throw new Error('missing');
    },
  };
}

describe('provisionAdministrative', () => {
  it('creates an ADMINISTRATIVE with a hashed password', async () => {
    const store = createFakeStore();
    const plaintext = 'admin-password-12';

    const result = await provisionAdministrative(store, {
      email: '  Admin@Academia.Test ',
      password: plaintext,
      name: 'Operaciones',
    });

    expect(result.outcome).toBe('created');
    expect(result.user).toEqual({
      id: 'id-1',
      email: 'admin@academia.test',
      name: 'Operaciones',
      role: 'ADMINISTRATIVE',
    });

    const hash = store.hashes.get('admin@academia.test');
    expect(hash).toBeDefined();
    await expect(verifyPassword(plaintext, hash!)).resolves.toBe(true);
  });

  it('rejects an email already held by another role', async () => {
    const store = createFakeStore([
      {
        id: 'd-1',
        email: 'directora@academia.test',
        name: null,
        role: 'DIRECTOR',
        isActive: true,
        passwordHash: 'hash',
      },
    ]);

    await expect(
      provisionAdministrative(store, {
        email: 'directora@academia.test',
        password: 'admin-password-12',
      }),
    ).rejects.toBeInstanceOf(RoleConflictError);
  });

  it('always stores ADMINISTRATIVE', async () => {
    const store = createFakeStore();
    const result = await provisionAdministrative(store, {
      email: 'staff@academia.test',
      password: 'admin-password-12',
    });

    expect(result.user.role).toBe('ADMINISTRATIVE');
    expect(store.records.get('staff@academia.test')?.role).toBe('ADMINISTRATIVE');
  });
});
