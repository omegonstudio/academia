import { describe, expect, it } from 'vitest';
import { createSessionCodec } from './session.js';

const SECRET = 'unit-test-secret-that-is-long-enough-32';
const OTHER_SECRET = 'a-completely-different-secret-value-32ch';

describe('session codec', () => {
  it('round-trips claims', async () => {
    const codec = createSessionCodec(SECRET, 3600);
    const token = await codec.issue({ userId: 'user-1', role: 'DIRECTOR' });

    await expect(codec.verify(token)).resolves.toEqual({
      userId: 'user-1',
      role: 'DIRECTOR',
    });
  });

  it('rejects a token signed with another secret', async () => {
    const issuer = createSessionCodec(SECRET, 3600);
    const verifier = createSessionCodec(OTHER_SECRET, 3600);
    const token = await issuer.issue({ userId: 'user-1', role: 'STUDENT' });

    await expect(verifier.verify(token)).resolves.toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const codec = createSessionCodec(SECRET, 3600);
    const token = await codec.issue({ userId: 'user-1', role: 'STUDENT' });

    const [header, , signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'user-1', role: 'SUPER_ADMIN' }),
    ).toString('base64url');

    await expect(
      codec.verify(`${header}.${forged}.${signature}`),
    ).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const codec = createSessionCodec(SECRET, -1);
    const token = await codec.issue({ userId: 'user-1', role: 'STUDENT' });

    await expect(codec.verify(token)).resolves.toBeNull();
  });

  it('rejects a token carrying an unknown role', async () => {
    const codec = createSessionCodec(SECRET, 3600);
    // Cast through unknown: the type system forbids this, an attacker does not.
    const token = await codec.issue({
      userId: 'user-1',
      role: 'ROOT' as unknown as 'STUDENT',
    });

    await expect(codec.verify(token)).resolves.toBeNull();
  });

  it.each(['', 'not-a-token', 'a.b.c'])(
    'rejects malformed input (%s)',
    async (input) => {
      const codec = createSessionCodec(SECRET, 3600);

      await expect(codec.verify(input)).resolves.toBeNull();
    },
  );
});
