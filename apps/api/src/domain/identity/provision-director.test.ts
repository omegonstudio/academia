import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../../lib/password.js';
import {
  provisionDirector,
  RoleConflictError,
  type DirectorIdentityRecord,
  type DirectorProvisionStore,
} from './provision-director.js';

function createFakeStore(
  seed: Array<DirectorIdentityRecord & { passwordHash: string }> = [],
): DirectorProvisionStore & {
  hashes: Map<string, string>;
  records: Map<string, DirectorIdentityRecord>;
} {
  const records = new Map<string, DirectorIdentityRecord>(
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
      const record: DirectorIdentityRecord = {
        id: `id-${seq}`,
        email,
        name,
        role: 'DIRECTOR',
        isActive: true,
      };
      records.set(email, record);
      hashes.set(email, passwordHash);
      return { ...record };
    },
    async reassertActive(id) {
      for (const [email, record] of records) {
        if (record.id !== id) continue;
        const updated = { ...record, isActive: true, role: 'DIRECTOR' as const };
        records.set(email, updated);
        return { ...updated };
      }
      throw new Error('missing');
    },
  };
}

describe('provisionDirector', () => {
  it('creates a DIRECTOR with a hashed password', async () => {
    const store = createFakeStore();
    const plaintext = 'director-password-12';

    const result = await provisionDirector(store, {
      email: '  Directora@Academia.Test ',
      password: plaintext,
      name: 'Ana Directora',
    });

    expect(result.outcome).toBe('created');
    expect(result.user).toEqual({
      id: 'id-1',
      email: 'directora@academia.test',
      name: 'Ana Directora',
      role: 'DIRECTOR',
    });
    expect(result.user).not.toHaveProperty('passwordHash');

    const hash = store.hashes.get('directora@academia.test');
    expect(hash).toBeDefined();
    await expect(verifyPassword(plaintext, hash!)).resolves.toBe(true);
    expect(hash).not.toContain(plaintext);
  });

  it('reasserts an inactive DIRECTOR without overwriting the password', async () => {
    const store = createFakeStore([
      {
        id: 'd-1',
        email: 'directora@academia.test',
        name: 'Ana',
        role: 'DIRECTOR',
        isActive: false,
        passwordHash: 'existing-hash',
      },
    ]);

    const result = await provisionDirector(store, {
      email: 'directora@academia.test',
      password: 'a-brand-new-password',
    });

    expect(result.outcome).toBe('reasserted');
    expect(result.user.role).toBe('DIRECTOR');
    expect(store.records.get('directora@academia.test')?.isActive).toBe(true);
    expect(store.hashes.get('directora@academia.test')).toBe('existing-hash');
  });

  it('rejects an email already held by another role', async () => {
    const store = createFakeStore([
      {
        id: 'sa-1',
        email: 'omegon.info@gmail.com',
        name: null,
        role: 'SUPER_ADMIN',
        isActive: true,
        passwordHash: 'hash',
      },
    ]);

    await expect(
      provisionDirector(store, {
        email: 'omegon.info@gmail.com',
        password: 'director-password-12',
      }),
    ).rejects.toBeInstanceOf(RoleConflictError);
  });

  it('never accepts a client-supplied role (always stores DIRECTOR)', async () => {
    const store = createFakeStore();
    const result = await provisionDirector(store, {
      email: 'nueva@academia.test',
      password: 'director-password-12',
    });

    expect(result.user.role).toBe('DIRECTOR');
    expect(store.records.get('nueva@academia.test')?.role).toBe('DIRECTOR');
  });
});
