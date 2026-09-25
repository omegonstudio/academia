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

  it('hides Permisos and Administrativos for other roles', () => {
    for (const role of ROLES) {
      if (role === 'SUPER_ADMIN' || role === 'DIRECTOR') continue;
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
  const webSrc = join(__dirname, '..');

  it('does not ship academy-dev-session or hardcoded academia password', () => {
    const files = [
      'components/login-form.tsx',
      'app/login/page.tsx',
      'components/dashboard-shell.tsx',
      'app/dashboard/layout.tsx',
      'app/dashboard/settings/page.tsx',
      'components/logout-button.tsx',
      'lib/auth-shell.ts',
    ];
    for (const relative of files) {
      const source = readFileSync(join(webSrc, relative), 'utf8');
      expect(source).not.toMatch(/academy-dev-session/);
      expect(source).not.toMatch(/DEV MODE/);
      expect(source).not.toMatch(/password\s*===\s*['"]academia['"]/);
      expect(source).not.toMatch(/localStorage\.setItem\(\s*['"]academy/);
    }
  });

  it('login posts to the real auth endpoint', () => {
    const source = readFileSync(
      join(webSrc, 'components/login-form.tsx'),
      'utf8',
    );
    expect(source).toContain('/api/auth/login');
    expect(source).toContain("credentials: 'include'");
  });

  it('logout posts to the real auth endpoint', () => {
    const source = readFileSync(
      join(webSrc, 'components/logout-button.tsx'),
      'utf8',
    );
    expect(source).toContain('/api/auth/logout');
    expect(source).toContain("credentials: 'include'");
  });

  it('dashboard layout gates on getSession server-side', () => {
    const source = readFileSync(
      join(webSrc, 'app/dashboard/layout.tsx'),
      'utf8',
    );
    expect(source).toContain('getSession');
    expect(source).toContain("redirect('/login')");
    expect(source).toContain('robots');
    expect(source).toContain('Saltar al contenido');
  });

  it('login page sets noindex and redirects when session exists', () => {
    const source = readFileSync(join(webSrc, 'app/login/page.tsx'), 'utf8');
    expect(source).toContain('getSession');
    expect(source).toContain("redirect('/dashboard')");
    expect(source).toMatch(/robots:\s*\{\s*index:\s*false/);
  });
});
