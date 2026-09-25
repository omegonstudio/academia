import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG } from '@academia/shared';
import { hashPassword } from '../../lib/password.js';
import {
  buildTestApp,
  cookieFrom,
  SESSION_COOKIE,
  type TestApp,
} from '../../test/build-test-app.js';

describe('administrative permissions routes', () => {
  let fixture: TestApp;

  beforeEach(async () => {
    fixture = await buildTestApp();
  });

  async function loginAs(
    email: string,
    password: string,
  ): Promise<string | undefined> {
    const response = await request(fixture.app)
      .post('/auth/login')
      .send({ email, password });
    return cookieFrom(response.headers['set-cookie'], SESSION_COOKIE);
  }

  async function seedRole(
    role: 'SUPER_ADMIN' | 'DIRECTOR' | 'ADMINISTRATIVE' | 'TEACHER' | 'STUDENT',
    email: string,
    password: string,
  ): Promise<void> {
    fixture.users.seed({
      id: `${role.toLowerCase()}-1`,
      email,
      name: role,
      role,
      isActive: true,
      passwordHash: await hashPassword(password),
    });
  }

  it('rejects anonymous callers on catalog and grant routes', async () => {
    const catalog = await request(fixture.app).get('/permissions/catalog');
    expect(catalog.status).toBe(401);

    const grant = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .send({ module: 'students', action: 'read' });
    expect(grant.status).toBe(401);
  });

  it.each([
    ['ADMINISTRATIVE', 'admin@academia.test', 'admin-password-12'],
    ['TEACHER', 'docente@academia.test', 'teacher-password-12'],
    ['STUDENT', 'estudiante@academia.test', 'student-password-12'],
  ] as const)(
    'returns 403 when %s lacks permissions.read/update',
    async (role, email, password) => {
      await seedRole(role, email, password);
      const cookie = await loginAs(email, password);

      const catalog = await request(fixture.app)
        .get('/permissions/catalog')
        .set('Cookie', cookie!);
      expect(catalog.status).toBe(403);
      expect(catalog.body.error.code).toBe('FORBIDDEN');

      const listed = await request(fixture.app)
        .get('/roles/administrative/permissions')
        .set('Cookie', cookie!);
      expect(listed.status).toBe(403);

      const grant = await request(fixture.app)
        .post('/roles/administrative/permissions')
        .set('Cookie', cookie!)
        .send({ module: 'students', action: 'read' });
      expect(grant.status).toBe(403);

      const revoke = await request(fixture.app)
        .delete('/roles/administrative/permissions')
        .set('Cookie', cookie!)
        .send({ module: 'students', action: 'read' });
      expect(revoke.status).toBe(403);
    },
  );

  it('returns 403 when ADMINISTRATIVE has read but not update', async () => {
    await seedRole(
      'ADMINISTRATIVE',
      'admin@academia.test',
      'admin-password-12',
    );
    await fixture.administrativePermissions.grant('permissions', 'read');
    const cookie = await loginAs('admin@academia.test', 'admin-password-12');

    const catalog = await request(fixture.app)
      .get('/permissions/catalog')
      .set('Cookie', cookie!);
    expect(catalog.status).toBe(200);

    const grant = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .set('Cookie', cookie!)
      .send({ module: 'students', action: 'read' });
    expect(grant.status).toBe(403);
    expect(grant.body.error.code).toBe('FORBIDDEN');

    const revoke = await request(fixture.app)
      .delete('/roles/administrative/permissions')
      .set('Cookie', cookie!)
      .send({ module: 'students', action: 'read' });
    expect(revoke.status).toBe(403);
  });

  it('lets DIRECTOR read catalog, grant, list and revoke', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const catalog = await request(fixture.app)
      .get('/permissions/catalog')
      .set('Cookie', cookie!);
    expect(catalog.status).toBe(200);
    expect(catalog.body.permissions).toEqual([...PERMISSION_CATALOG]);

    const created = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .set('Cookie', cookie!)
      .send({ module: 'students', action: 'read' });
    expect(created.status).toBe(201);
    expect(created.body.permission).toEqual({
      module: 'students',
      action: 'read',
    });

    const again = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .set('Cookie', cookie!)
      .send({ module: 'students', action: 'read' });
    expect(again.status).toBe(200);

    const listed = await request(fixture.app)
      .get('/roles/administrative/permissions')
      .set('Cookie', cookie!);
    expect(listed.status).toBe(200);
    expect(listed.body.permissions).toEqual([
      { module: 'students', action: 'read' },
    ]);

    const revoked = await request(fixture.app)
      .delete('/roles/administrative/permissions')
      .set('Cookie', cookie!)
      .send({ module: 'students', action: 'read' });
    expect(revoked.status).toBe(204);

    const empty = await request(fixture.app)
      .get('/roles/administrative/permissions')
      .set('Cookie', cookie!);
    expect(empty.body.permissions).toEqual([]);

    expect(fixture.permissionChangeAudits.entries()).toEqual([
      {
        actorUserId: 'director-1',
        targetRole: 'ADMINISTRATIVE',
        changeType: 'GRANT',
        module: 'students',
        action: 'read',
        outcome: 'created',
      },
      {
        actorUserId: 'director-1',
        targetRole: 'ADMINISTRATIVE',
        changeType: 'GRANT',
        module: 'students',
        action: 'read',
        outcome: 'exists',
      },
      {
        actorUserId: 'director-1',
        targetRole: 'ADMINISTRATIVE',
        changeType: 'REVOKE',
        module: 'students',
        action: 'read',
        outcome: 'removed',
      },
    ]);
  });

  it('lets SUPER_ADMIN grant a permission', async () => {
    await seedRole(
      'SUPER_ADMIN',
      'omegon.info@gmail.com',
      'superadmin-password',
    );
    const cookie = await loginAs(
      'omegon.info@gmail.com',
      'superadmin-password',
    );

    const created = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .set('Cookie', cookie!)
      .send({ module: 'finance', action: 'update' });

    expect(created.status).toBe(201);
  });

  it('rejects non-catalog permission payloads with 400', async () => {
    await seedRole('DIRECTOR', 'directora@academia.test', 'director-password-12');
    const cookie = await loginAs(
      'directora@academia.test',
      'director-password-12',
    );

    const response = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .set('Cookie', cookie!)
      .send({ module: 'students', action: 'explode' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('does not audit when the caller is forbidden', async () => {
    await seedRole('TEACHER', 'docente@academia.test', 'teacher-password-12');
    const cookie = await loginAs('docente@academia.test', 'teacher-password-12');

    const response = await request(fixture.app)
      .post('/roles/administrative/permissions')
      .set('Cookie', cookie!)
      .send({ module: 'students', action: 'read' });

    expect(response.status).toBe(403);
    expect(fixture.permissionChangeAudits.entries()).toEqual([]);
  });
});
