import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(
      true,
    );
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('never stores the plaintext', async () => {
    const password = 'plaintext-must-not-appear';
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
  });

  it('salts each hash so identical passwords differ', async () => {
    const [first, second] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);

    expect(first).not.toBe(second);
    await expect(verifyPassword('same-password', first)).resolves.toBe(true);
    await expect(verifyPassword('same-password', second)).resolves.toBe(true);
  });

  it('encodes the algorithm and its parameters', async () => {
    const hash = await hashPassword('any');

    expect(hash.split('$')).toHaveLength(6);
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('normalises unicode so equivalent inputs match', async () => {
    // "é" as a single code point vs. "e" + combining acute accent.
    const hash = await hashPassword('caf\u00e9');

    await expect(verifyPassword('cafe\u0301', hash)).resolves.toBe(true);
  });

  it.each([
    ['empty', ''],
    ['not a hash', 'nonsense'],
    ['wrong field count', 'scrypt$16384$8$1$onlyfive'],
    ['unknown algorithm', 'bcrypt$16384$8$1$c2FsdA$a2V5'],
    ['non-numeric cost', 'scrypt$abc$8$1$c2FsdA$a2V5'],
  ])('returns false for a malformed hash (%s)', async (_label, stored) => {
    await expect(verifyPassword('any', stored)).resolves.toBe(false);
  });
});
