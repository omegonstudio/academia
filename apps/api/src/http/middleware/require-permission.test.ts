import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionGrantStore } from '../../domain/authorization/has-permission.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';
import { requirePermission } from './require-permission.js';

function createStore(owns: boolean): PermissionGrantStore {
  return {
    roleOwns: vi.fn(async () => owns),
  };
}

function invoke(
  handler: ReturnType<typeof requirePermission>,
  req: Partial<Request>,
): Promise<{ next: NextFunction; error?: unknown }> {
  return new Promise((resolve) => {
    const next: NextFunction = ((error?: unknown) => {
      resolve({ next, error });
    }) as NextFunction;

    handler(req as Request, {} as Response, next);
  });
}

describe('requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when authenticate has not set req.user', async () => {
    const store = createStore(true);
    const { error } = await invoke(
      requirePermission(store, 'students', 'read'),
      {},
    );

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(store.roleOwns).not.toHaveBeenCalled();
  });

  it('allows SUPER_ADMIN without consulting grants', async () => {
    const store = createStore(false);
    const { error } = await invoke(
      requirePermission(store, 'finance', 'update'),
      { user: { id: '1', email: 'sa@test', name: null, role: 'SUPER_ADMIN' } },
    );

    expect(error).toBeUndefined();
    expect(store.roleOwns).not.toHaveBeenCalled();
  });

  it('allows DIRECTOR without consulting grants', async () => {
    const store = createStore(false);
    const { error } = await invoke(
      requirePermission(store, 'users', 'create'),
      {
        user: {
          id: '2',
          email: 'dir@test',
          name: 'Dir',
          role: 'DIRECTOR',
        },
      },
    );

    expect(error).toBeUndefined();
    expect(store.roleOwns).not.toHaveBeenCalled();
  });

  it('allows ADMINISTRATIVE when the role owns the grant', async () => {
    const store = createStore(true);
    const { error } = await invoke(
      requirePermission(store, 'students', 'read'),
      {
        user: {
          id: '3',
          email: 'admin@test',
          name: null,
          role: 'ADMINISTRATIVE',
        },
      },
    );

    expect(error).toBeUndefined();
    expect(store.roleOwns).toHaveBeenCalledWith(
      'ADMINISTRATIVE',
      'students',
      'read',
    );
  });

  it('forbids ADMINISTRATIVE without the grant', async () => {
    const store = createStore(false);
    const { error } = await invoke(
      requirePermission(store, 'students', 'read'),
      {
        user: {
          id: '3',
          email: 'admin@test',
          name: null,
          role: 'ADMINISTRATIVE',
        },
      },
    );

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it('forbids TEACHER and STUDENT without grants', async () => {
    const store = createStore(false);

    const teacher = await invoke(
      requirePermission(store, 'classes', 'read'),
      {
        user: {
          id: '4',
          email: 't@test',
          name: null,
          role: 'TEACHER',
        },
      },
    );
    expect(teacher.error).toBeInstanceOf(ForbiddenError);

    const student = await invoke(
      requirePermission(store, 'materials', 'read'),
      {
        user: {
          id: '5',
          email: 's@test',
          name: null,
          role: 'STUDENT',
        },
      },
    );
    expect(student.error).toBeInstanceOf(ForbiddenError);
  });

  it('ignores a client-supplied permissions header or body', async () => {
    const store = createStore(false);
    const { error } = await invoke(
      requirePermission(store, 'students', 'update'),
      {
        user: {
          id: '3',
          email: 'admin@test',
          name: null,
          role: 'ADMINISTRATIVE',
        },
        headers: { 'x-permissions': 'students:update' },
        body: { permissions: [{ module: 'students', action: 'update' }] },
      },
    );

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(store.roleOwns).toHaveBeenCalledTimes(1);
  });
});
