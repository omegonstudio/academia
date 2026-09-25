import { describe, expect, it, vi } from 'vitest';
import {
  createStudent,
  StudentConflictError,
  StudentValidationError,
  type StudentStore,
} from './student-service.js';

function createStore(
  overrides: Partial<StudentStore> = {},
): StudentStore {
  return {
    list: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findByUserId: vi.fn(async () => null),
    findUserByEmail: vi.fn(async () => null),
    createWithNewUser: vi.fn(async (input) => ({
      id: 's-1',
      userId: 'u-1',
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      level: input.level,
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

describe('createStudent', () => {
  it('creates a new user and student when email is free', async () => {
    const store = createStore();
    const hashPassword = vi.fn(async () => 'hashed');

    const student = await createStudent(
      store,
      {
        email: 'ana@academia.test',
        password: 'student-password-12',
        firstName: 'Ana',
        lastName: 'Pérez',
        level: 'A1',
      },
      hashPassword,
    );

    expect(hashPassword).toHaveBeenCalled();
    expect(store.createWithNewUser).toHaveBeenCalled();
    expect(student.email).toBe('ana@academia.test');
    expect(student).not.toHaveProperty('passwordHash');
  });

  it('requires password for a brand-new account', async () => {
    const store = createStore();

    await expect(
      createStudent(
        store,
        {
          email: 'ana@academia.test',
          firstName: 'Ana',
          lastName: 'Pérez',
          level: 'A1',
        },
        vi.fn(async () => 'hashed'),
      ),
    ).rejects.toBeInstanceOf(StudentValidationError);
  });

  it('rejects emails that belong to another role', async () => {
    const store = createStore({
      findUserByEmail: vi.fn(async () => ({
        id: 'u-1',
        email: 'docente@academia.test',
        role: 'TEACHER',
        hasStudent: false,
      })),
    });

    await expect(
      createStudent(
        store,
        {
          email: 'docente@academia.test',
          password: 'student-password-12',
          firstName: 'Ana',
          lastName: 'Pérez',
          level: 'A1',
        },
        vi.fn(async () => 'hashed'),
      ),
    ).rejects.toBeInstanceOf(StudentConflictError);
  });
});
