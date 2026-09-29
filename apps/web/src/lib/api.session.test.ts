import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    toString(): string {
      return 'academia_session=test-cookie';
    },
  })),
}));

describe('getSession', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the real session user when /auth/me succeeds', async () => {
    const user = {
      id: 'user-1',
      email: 'omegon.info@gmail.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ user }),
      })),
    );

    const { getSession } = await import('./api.js');
    await expect(getSession()).resolves.toEqual(user);
  });

  it('returns null when there is no valid session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized' }),
      })),
    );

    const { getSession } = await import('./api.js');
    await expect(getSession()).resolves.toBeNull();
  });

  it('returns null when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );

    const { getSession } = await import('./api.js');
    await expect(getSession()).resolves.toBeNull();
  });
});
