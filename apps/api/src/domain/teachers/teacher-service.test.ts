import { describe, expect, it, vi } from 'vitest';
import {
  createTeacher,
  TeacherConflictError,
  TeacherValidationError,
  type TeacherStore,
} from './teacher-service.js';

function createStore(overrides: Partial<TeacherStore> = {}): TeacherStore {
  return {
    list: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findByUserId: vi.fn(async () => null),
    findUserByEmail: vi.fn(async () => null),
    createWithNewUser: vi.fn(async (input) => ({
      id: 't-1',
      userId: 'u-1',
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      level: input.level,
      availability: input.availability,
      isActive: input.isActive,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })),
    createForExistingUser: vi.fn(async () => {
      throw new Error('unused');
    }),
    update: vi.fn(async () => {
      throw new Error('unused');
    }),
    softDelete: vi.fn(async () => {
      throw new Error('unused');
    }),
    ...overrides,
  };
}

describe('createTeacher', () => {
  it('creates a new user and teacher when email is free', async () => {
    const store = createStore();
    const hashPassword = vi.fn(async () => 'hashed');

    const teacher = await createTeacher(
      store,
      {
        email: 'eva@academia.test',
        password: 'teacher-password-12',
        firstName: 'Eva',
        lastName: 'Ruiz',
        level: 'C1',
      },
      hashPassword,
    );

    expect(hashPassword).toHaveBeenCalled();
    expect(store.createWithNewUser).toHaveBeenCalled();
    expect(teacher.email).toBe('eva@academia.test');
    expect(teacher.availability).toBe('AVAILABLE');
    expect(teacher).not.toHaveProperty('passwordHash');
  });

  it('requires password for a brand-new account', async () => {
    const store = createStore();

    await expect(
      createTeacher(
        store,
        {
          email: 'eva@academia.test',
          firstName: 'Eva',
          lastName: 'Ruiz',
          level: 'C1',
        },
        vi.fn(async () => 'hashed'),
      ),
    ).rejects.toBeInstanceOf(TeacherValidationError);
  });

  it('rejects emails that belong to another role', async () => {
    const store = createStore({
      findUserByEmail: vi.fn(async () => ({
        id: 'u-1',
        email: 'alumno@academia.test',
        role: 'STUDENT',
        hasTeacher: false,
      })),
    });

    await expect(
      createTeacher(
        store,
        {
          email: 'alumno@academia.test',
          password: 'teacher-password-12',
          firstName: 'Eva',
          lastName: 'Ruiz',
          level: 'C1',
        },
        vi.fn(async () => 'hashed'),
      ),
    ).rejects.toBeInstanceOf(TeacherConflictError);
  });
});
