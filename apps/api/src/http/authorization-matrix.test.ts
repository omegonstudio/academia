import type { Role } from '@academia/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../test/build-test-app.js';

/**
 * Stage 1 authorization matrix for Stage 1 protected API routes
 * (user provisioning + administrative permission management).
 * Academy module routes (students, classes, …) have their own suites;
 * a full cross-module matrix remains Stage 9.
 * Reuses `buildTestApp` — no duplicate app factory.
 */

const ACTORS: ReadonlyArray<{
  role: Role;
  email: string;
  password: string;
}> = [
  {
    role: 'SUPER_ADMIN',
    email: 'omegon.info@gmail.com',
    password: 'superadmin-password',
  },
  {
    role: 'DIRECTOR',
    email: 'directora@academia.test',
    password: 'director-password-12',
  },
  {
    role: 'ADMINISTRATIVE',
    email: 'admin@academia.test',
    password: 'admin-password-12',
  },
  {
    role: 'TEACHER',
    email: 'docente@academia.test',
    password: 'teacher-password-12',
  },
  {
    role: 'STUDENT',
    email: 'estudiante@academia.test',
    password: 'student-password-12',
  },
];

const ROLES = ACTORS.map((actor) => actor.role);

/** Expected HTTP status when the caller has no RolePermission grants. */
const MATRIX_WITHOUT_GRANTS: ReadonlyArray<{
  name: string;
  method: 'get' | 'post' | 'delete';
  path: string;
  body?: Record<string, string>;
  expected: Record<Role, number>;
}> = [
  {
    name: 'POST /users/directors',
    method: 'post',
    path: '/users/directors',
    body: {
      email: 'new-director@academia.test',
      password: 'director-password-12',
    },
    expected: {
      SUPER_ADMIN: 201,
      DIRECTOR: 403,
      ADMINISTRATIVE: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    name: 'POST /users/administratives',
    method: 'post',
    path: '/users/administratives',
    body: {
      email: 'new-admin@academia.test',
      password: 'admin-password-12',
    },
    expected: {
      SUPER_ADMIN: 201,
      DIRECTOR: 201,
      ADMINISTRATIVE: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    name: 'POST /users/teachers',
    method: 'post',
    path: '/users/teachers',
    body: {
      email: 'new-teacher@academia.test',
      password: 'teacher-password-12',
    },
    expected: {
      SUPER_ADMIN: 201,
      DIRECTOR: 201,
      ADMINISTRATIVE: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    name: 'POST /users/students',
    method: 'post',
    path: '/users/students',
    body: {
      email: 'new-student@academia.test',
      password: 'student-password-12',
    },
    expected: {
      SUPER_ADMIN: 201,
      DIRECTOR: 201,
      ADMINISTRATIVE: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    name: 'GET /permissions/catalog',
    method: 'get',
    path: '/permissions/catalog',
    expected: {
      SUPER_ADMIN: 200,
      DIRECTOR: 200,
      ADMINISTRATIVE: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    name: 'GET /roles/administrative/permissions',
    method: 'get',
    path: '/roles/administrative/permissions',
    expected: {
      SUPER_ADMIN: 200,
      DIRECTOR: 200,
      ADMINISTRATIVE: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    name: 'POST /roles/administrative/permissions',
    method: 'post',
    path: '/roles/administrative/permissions',
    body: { module: 'students', action: 'read' },
    expected: {
      SUPER_ADMIN: 201,
      DIRECTOR: 201,
      ADMINISTRATIVE: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    name: 'DELETE /roles/administrative/permissions',
    method: 'delete',
    path: '/roles/administrative/permissions',
    body: { module: 'finance', action: 'read' },
    expected: {
      SUPER_ADMIN: 204,
      DIRECTOR: 204,
      ADMINISTRATIVE: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
];

describe('Stage 1 authorization matrix', () => {
  let fixture: TestApp;
  let cookies: Map<Role, string>;

  beforeEach(async () => {
    fixture = await buildTestApp();
    cookies = new Map();

    for (const actor of ACTORS) {
      fixture.users.seed({
        id: `${actor.role.toLowerCase()}-matrix`,
        email: actor.email,
        name: actor.role,
        role: actor.role,
        isActive: true,
        passwordHash: await hashPassword(actor.password),
      });

      const login = await request(fixture.app)
        .post('/auth/login')
        .send({ email: actor.email, password: actor.password });
      const cookie = cookieFrom(login.headers['set-cookie'], SESSION_COOKIE);
      expect(cookie).toBeDefined();
      cookies.set(actor.role, cookie!);
    }
  });

  it('covers every role in the product matrix', () => {
    expect(ROLES).toEqual([
      'SUPER_ADMIN',
      'DIRECTOR',
      'ADMINISTRATIVE',
      'TEACHER',
      'STUDENT',
    ]);
  });

  it('rejects anonymous callers on every protected route with 401', async () => {
    for (const route of MATRIX_WITHOUT_GRANTS) {
      const pending = request(fixture.app)[route.method](route.path);
      const response = route.body
        ? await pending.send(route.body)
        : await pending;
      expect(response.status, route.name).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  describe.each(MATRIX_WITHOUT_GRANTS)(
    '$name without RolePermission grants',
    (route) => {
      it.each(ROLES)('%s', async (role) => {
        fixture.administrativePermissions.clear();

        const uniqueBody = route.body
          ? {
              ...route.body,
              ...(route.body.email
                ? {
                    email: `${role.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.${route.body.email}`,
                  }
                : {}),
            }
          : undefined;

        const cookie = cookies.get(role)!;
        const response =
          route.method === 'get'
            ? await request(fixture.app).get(route.path).set('Cookie', cookie)
            : route.method === 'delete'
              ? await request(fixture.app)
                  .delete(route.path)
                  .set('Cookie', cookie)
                  .send(uniqueBody ?? {})
              : await request(fixture.app)
                  .post(route.path)
                  .set('Cookie', cookie)
                  .send(uniqueBody ?? {});

        expect(response.status).toBe(route.expected[role]);
        if (route.expected[role] === 403) {
          expect(response.body.error.code).toBe('FORBIDDEN');
        }
      });
    },
  );

  it('lets ADMINISTRATIVE through only when the required grant exists', async () => {
    const cookie = cookies.get('ADMINISTRATIVE')!;

    await fixture.administrativePermissions.grant('permissions', 'read');
    const catalog = await request(fixture.app)
      .get('/permissions/catalog')
      .set('Cookie', cookie);
    expect(catalog.status).toBe(200);

    const listed = await request(fixture.app)
      .get('/roles/administrative/permissions')
      .set('Cookie', cookie);
    expect(listed.status).toBe(200);

    const deniedUpdate = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .set('Cookie', cookie)
      .send({ module: 'classes', action: 'read' });
    expect(deniedUpdate.status).toBe(403);

    await fixture.administrativePermissions.grant('permissions', 'update');
    const granted = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .set('Cookie', cookie)
      .send({ module: 'classes', action: 'read' });
    expect(granted.status).toBe(201);

    await fixture.administrativePermissions.grant('users', 'create');
    const provisioned = await request(fixture.app)
      .post('/users/teachers')
      .set('Cookie', cookie)
      .send({
        email: 'granted-teacher@academia.test',
        password: 'teacher-password-12',
      });
    expect(provisioned.status).toBe(201);
  });

  it('ignores client-supplied permission claims on the request', async () => {
    const cookie = cookies.get('TEACHER')!;

    const response = await request(fixture.app)
      .post('/users/students')
      .set('Cookie', cookie)
      .set('x-permissions', 'users:create')
      .set('x-role', 'SUPER_ADMIN')
      .send({
        email: 'spoofed@academia.test',
        password: 'student-password-12',
        permissions: [{ module: 'users', action: 'create' }],
        role: 'SUPER_ADMIN',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('lets every authenticated role read GET /auth/me from the server session', async () => {
    for (const actor of ACTORS) {
      const response = await request(fixture.app)
        .get('/auth/me')
        .set('Cookie', cookies.get(actor.role)!);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe(actor.role);
      expect(response.body.user.email).toBe(actor.email);
    }
  });
});
