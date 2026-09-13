import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../../lib/password.js';
import {
  provisionTeacher,
  RoleConflictError,
  type TeacherIdentityRecord,
  type TeacherProvisionStore,
} from './provision-teacher.js';

function createFakeStore(
  seed: Array<TeacherIdentityRecord & { passwordHash: string }> = [],
): TeacherProvisionStore & {
  hashes: Map<string, string>;
  records: Map<string, TeacherIdentityRecord>;
} {
  const records = new Map<string, TeacherIdentityRecord>(
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
      const record: TeacherIdentityRecord = {
        id: `id-${seq}`,
        email,
        name,
        role: 'TEACHER',
        isActive: true,
      };
      records.set(email, record);
      hashes.set(email, passwordHash);
      return { ...record };
    },
    async reassertActive(id) {
      for (const [email, record] of records) {
        if (record.id !== id) continue;
        const updated = { ...record, isActive: true, role: 'TEACHER' as const };
        records.set(email, updated);
        return { ...updated };
      }
      throw new Error('missing');
    },
  };
}

describe('provisionTeacher', () => {
  it('creates a TEACHER with a hashed password', async () => {
    const store = createFakeStore();
    const plaintext = 'teacher-password-12';

    const result = await provisionTeacher(store, {
      email: '  Docente@Academia.Test ',
      password: plaintext,
      name: 'María Docente',
    });

    expect(result.outcome).toBe('created');
    expect(result.user).toEqual({
      id: 'id-1',
      email: 'docente@academia.test',
      name: 'María Docente',
      role: 'TEACHER',
    });

    const hash = store.hashes.get('docente@academia.test');
    expect(hash).toBeDefined();
    await expect(verifyPassword(plaintext, hash!)).resolves.toBe(true);
  });

  it('reasserts an inactive TEACHER without overwriting the password', async () => {
    const store = createFakeStore([
      {
        id: 't-1',
        email: 'docente@academia.test',
        name: 'María',
        role: 'TEACHER',
        isActive: false,
        passwordHash: 'existing-hash',
      },
    ]);

    const result = await provisionTeacher(store, {
      email: 'docente@academia.test',
      password: 'a-brand-new-password',
    });

    expect(result.outcome).toBe('reasserted');
    expect(result.user.role).toBe('TEACHER');
    expect(store.records.get('docente@academia.test')?.isActive).toBe(true);
    expect(store.hashes.get('docente@academia.test')).toBe('existing-hash');
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
      provisionTeacher(store, {
        email: 'directora@academia.test',
        password: 'teacher-password-12',
      }),
    ).rejects.toBeInstanceOf(RoleConflictError);
  });

  it('always stores TEACHER', async () => {
    const store = createFakeStore();
    const result = await provisionTeacher(store, {
      email: 'nueva@academia.test',
      password: 'teacher-password-12',
    });

    expect(result.user.role).toBe('TEACHER');
    expect(store.records.get('nueva@academia.test')?.role).toBe('TEACHER');
  });
});
