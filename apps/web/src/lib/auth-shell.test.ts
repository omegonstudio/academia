import { ROLES } from '@academia/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dashboardNavSections,
  loginErrorMessage,
  sessionDisplayName,
  sessionInitials,
} from './auth-shell.js';

describe('loginErrorMessage', () => {
  it('uses a generic message for invalid credentials', () => {
    expect(loginErrorMessage(401)).toMatch(/correo|contraseña/i);
    expect(loginErrorMessage(401)).not.toMatch(/no existe|email no/i);
  });

  it('handles rate limits without technical jargon', () => {
    const message = loginErrorMessage(429);
    expect(message).toMatch(/intentos|minutos/i);
    expect(message).not.toMatch(/429|rate|throttle/i);
  });
});

describe('dashboardNavSections', () => {
  it('gives STUDENT a self-scoped hub without admin finance links', () => {
    const hrefs = dashboardNavSections('STUDENT')
      .flatMap((section) => section.links)
      .map((link) => link.href);
    expect(hrefs).toEqual([
      '/dashboard/student',
      '/dashboard/student/classes',
      '/dashboard/student/materials',
      '/dashboard/student/attendance',
      '/dashboard/student/finance',
    ]);
    expect(hrefs).not.toContain('/dashboard/finance');
    expect(hrefs).not.toContain('/dashboard/students');
  });

  it('gives TEACHER a self-scoped hub without admin finance links', () => {
    const hrefs = dashboardNavSections('TEACHER')
      .flatMap((section) => section.links)
      .map((link) => link.href);
    expect(hrefs).toEqual([
      '/dashboard/teacher',
      '/dashboard/teacher/classes',
      '/dashboard/teacher/students',
      '/dashboard/teacher/materials',
      '/dashboard/teacher/attendance',
      '/dashboard/teacher/earnings',
    ]);
    expect(hrefs).not.toContain('/dashboard/finance');
    expect(hrefs).not.toContain('/dashboard/students');
  });

  it('shows Permisos and Administrativos for SUPER_ADMIN and DIRECTOR', () => {
    for (const role of ['SUPER_ADMIN', 'DIRECTOR'] as const) {
      const hrefs = dashboardNavSections(role)
        .flatMap((section) => section.links)
        .map((link) => link.href);
      expect(hrefs).toContain('/dashboard/permissions');
      expect(hrefs).toContain('/dashboard/administratives');
      expect(hrefs).toContain('/dashboard/settings');
    }
  });

  it('includes Finanzas for staff roles except self-scoped hubs', () => {
    for (const role of ROLES) {
      if (role === 'STUDENT' || role === 'TEACHER') continue;
      const hrefs = dashboardNavSections(role)
        .flatMap((section) => section.links)
        .map((link) => link.href);
      expect(hrefs).toContain('/dashboard/finance');
    }
  });

  it('hides Permisos and Administrativos for non-director staff', () => {
    for (const role of ROLES) {
      if (
        role === 'SUPER_ADMIN' ||
        role === 'DIRECTOR' ||
        role === 'STUDENT' ||
        role === 'TEACHER'
      ) {
        continue;
      }
      const hrefs = dashboardNavSections(role)
        .flatMap((section) => section.links)
        .map((link) => link.href);
      expect(hrefs).not.toContain('/dashboard/permissions');
      expect(hrefs).not.toContain('/dashboard/administratives');
      expect(hrefs).toContain('/dashboard/settings');
      expect(hrefs).toContain('/dashboard');
    }
  });
});

describe('session display helpers', () => {
  it('prefers name when present', () => {
    expect(
      sessionDisplayName({ name: 'Ana Pérez', email: 'ana@example.com' }),
    ).toBe('Ana Pérez');
    expect(
      sessionInitials({ name: 'Ana Pérez', email: 'ana@example.com' }),
    ).toBe('AP');
  });

  it('falls back to email when name is missing', () => {
    expect(sessionDisplayName({ name: null, email: 'director@example.com' })).toBe(
      'director@example.com',
    );
    expect(sessionInitials({ name: null, email: 'director@example.com' })).toBe(
      'DI',
    );
  });
});

describe('DEV bypass absence', () => {
  it('does not ship a DEV auth bypass in auth-shell', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/auth-shell.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/DEV_AUTH|bypass|fakeSession/i);
  });
});
