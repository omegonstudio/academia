import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../lib/password.js';
import {
  createInMemoryUserRepository,
  type InMemoryUserRepository,
} from '../../test/in-memory-user-repository.js';
import { createAuthService, type AuthService } from './auth-service.js';

const PASSWORD = 'a-valid-director-password';

describe('auth service', () => {
  let users: InMemoryUserRepository;
  let service: AuthService;

  beforeEach(async () => {
    users = createInMemoryUserRepository();
    service = createAuthService(users);

    users.seed({
      id: 'user-director',
      email: 'Directora@Academia.test',
      name: 'Directora',
      role: 'DIRECTOR',
      isActive: true,
      passwordHash: await hashPassword(PASSWORD),
    });
  });

  it('authenticates valid credentials', async () => {
    const user = await service.authenticate('directora@academia.test', PASSWORD);

    expect(user).toEqual({
      id: 'user-director',
      email: 'directora@academia.test',
      name: 'Directora',
      role: 'DIRECTOR',
    });
  });

  it('accepts the email in any casing or with surrounding space', async () => {
    const user = await service.authenticate('  DIRECTORA@academia.test  ', PASSWORD);

    expect(user?.id).toBe('user-director');
  });

  it('never exposes the password hash', async () => {
    const user = await service.authenticate('directora@academia.test', PASSWORD);

    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('isActive');
  });

  it('rejects a wrong password', async () => {
    await expect(
      service.authenticate('directora@academia.test', 'wrong'),
    ).resolves.toBeNull();
  });

  it('rejects an unknown email', async () => {
    await expect(
      service.authenticate('nobody@academia.test', PASSWORD),
    ).resolves.toBeNull();
  });

  it('rejects a deactivated account holding the right password', async () => {
    users.seed({
      id: 'user-inactive',
      email: 'inactive@academia.test',
      name: null,
      role: 'TEACHER',
      isActive: false,
      passwordHash: await hashPassword(PASSWORD),
    });

    await expect(
      service.authenticate('inactive@academia.test', PASSWORD),
    ).resolves.toBeNull();
  });

  it('records the login timestamp on success only', async () => {
    await service.authenticate('directora@academia.test', 'wrong');
    expect(users.loginTimestamps().has('user-director')).toBe(false);

    await service.authenticate('directora@academia.test', PASSWORD);
    expect(users.loginTimestamps().has('user-director')).toBe(true);
  });

  it('does not load a deactivated user for an existing session', async () => {
    users.seed({
      id: 'user-suspended',
      email: 'suspended@academia.test',
      name: null,
      role: 'STUDENT',
      isActive: false,
      passwordHash: await hashPassword(PASSWORD),
    });

    await expect(service.loadActiveUser('user-suspended')).resolves.toBeNull();
    await expect(service.loadActiveUser('user-director')).resolves.not.toBeNull();
  });
});
