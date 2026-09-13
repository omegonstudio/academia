import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../../lib/password.js';
import {
  provisionStudent,
  RoleConflictError,
  type StudentIdentityRecord,
  type StudentProvisionStore,
} from './provision-student.js';

function createFakeStore(
  seed: Array<StudentIdentityRecord & { passwordHash: string }> = [],
): StudentProvisionStore & {
  hashes: Map<string, string>;
  records: Map<string, StudentIdentityRecord>;
} {
  const records = new Map<string, StudentIdentityRecord>(
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
      const record: StudentIdentityRecord = {
        id: `id-${seq}`,
        email,
        name,
        role: 'STUDENT',
        isActive: true,
      };
      records.set(email, record);
      hashes.set(email, passwordHash);
      return { ...record };
    },
    async reassertActive(id) {
      for (const [email, record] of records) {
        if (record.id !== id) continue;
        const updated = { ...record, isActive: true, role: 'STUDENT' as const };
        records.set(email, updated);
        return { ...updated };
      }
      throw new Error('missing');
    },
  };
}

describe('provisionStudent', () => {
  it('creates a STUDENT with a hashed password', async () => {
    const store = createFakeStore();
    const plaintext = 'student-password-12';

    const result = await provisionStudent(store, {
      email: '  Estudiante@Academia.Test ',
      password: plaintext,
      name: 'Lucía Estudiante',
    });

    expect(result.outcome).toBe('created');
    expect(result.user).toEqual({
      id: 'id-1',
      email: 'estudiante@academia.test',
      name: 'Lucía Estudiante',
      role: 'STUDENT',
    });

    const hash = store.hashes.get('estudiante@academia.test');
    expect(hash).toBeDefined();
    await expect(verifyPassword(plaintext, hash!)).resolves.toBe(true);
  });

  it('reasserts an inactive STUDENT without overwriting the password', async () => {
    const store = createFakeStore([
      {
        id: 's-1',
        email: 'estudiante@academia.test',
        name: 'Lucía',
        role: 'STUDENT',
        isActive: false,
        passwordHash: 'existing-hash',
      },
    ]);

    const result = await provisionStudent(store, {
      email: 'estudiante@academia.test',
      password: 'a-brand-new-password',
    });

    expect(result.outcome).toBe('reasserted');
    expect(result.user.role).toBe('STUDENT');
    expect(store.records.get('estudiante@academia.test')?.isActive).toBe(true);
    expect(store.hashes.get('estudiante@academia.test')).toBe('existing-hash');
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
      provisionStudent(store, {
        email: 'directora@academia.test',
        password: 'student-password-12',
      }),
    ).rejects.toBeInstanceOf(RoleConflictError);
  });

  it('always stores STUDENT', async () => {
    const store = createFakeStore();
    const result = await provisionStudent(store, {
      email: 'nueva@academia.test',
      password: 'student-password-12',
    });

    expect(result.user.role).toBe('STUDENT');
    expect(store.records.get('nueva@academia.test')?.role).toBe('STUDENT');
  });
});
