import type { SessionUser } from '@academia/shared';
import { isRole } from '@academia/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPermissionGrantStore } from '../domain/authorization/permission-grant-store.js';
import { errorHandler } from '../http/middleware/error-handler.js';
import { requirePermission } from '../http/middleware/require-permission.js';
import { createLogger } from '../lib/logger.js';
import { createPrismaClient, type Database } from '../lib/prisma.js';

/**
 * HTTP-level requirePermission against a real grant store. Uses a probe
 * route only inside this suite — production routes are not mounted.
 *
 * The `x-test-role` header substitutes for `authenticate` so the suite can
 * isolate requirePermission; production code never reads roles from headers.
 */
const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for the integration suite. Run it through ' +
      'scripts/test-integration.sh or set the variable explicitly.',
  );
}

function buildProbeApp(database: Database) {
  const store = createPermissionGrantStore(database);
  const app = express();

  app.get('/probe', (req, _res, next) => {
    const roleHeader = req.header('x-test-role');
    if (roleHeader && isRole(roleHeader)) {
      const user: SessionUser = {
        id: 'probe-user',
        email: 'probe@academia.test',
        name: null,
        role: roleHeader,
      };
      req.user = user;
    }
    next();
  });

  app.get(
    '/probe',
    requirePermission(store, 'students', 'read'),
    (_req, res) => {
      res.status(204).send();
    },
  );

  app.use(errorHandler(createLogger({ level: 'silent' })));
  return app;
}

describe('requirePermission integration', () => {
  let database: Database;
  let app: ReturnType<typeof buildProbeApp>;

  beforeAll(() => {
    database = createPrismaClient(DATABASE_URL);
    app = buildProbeApp(database);
  });

  afterAll(async () => {
    await database.rolePermission.deleteMany({
      where: { role: 'ADMINISTRATIVE' },
    });
    await database.$disconnect();
  });

  beforeEach(async () => {
    await database.rolePermission.deleteMany({
      where: { role: 'ADMINISTRATIVE' },
    });
  });

  it('returns 401 when no authenticated user is present', async () => {
    const response = await request(app).get('/probe');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows DIRECTOR without a RolePermission row', async () => {
    const response = await request(app)
      .get('/probe')
      .set('x-test-role', 'DIRECTOR');
    expect(response.status).toBe(204);
  });

  it('allows SUPER_ADMIN without a RolePermission row', async () => {
    const response = await request(app)
      .get('/probe')
      .set('x-test-role', 'SUPER_ADMIN');
    expect(response.status).toBe(204);
  });

  it('forbids ADMINISTRATIVE without the grant', async () => {
    const response = await request(app)
      .get('/probe')
      .set('x-test-role', 'ADMINISTRATIVE');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows ADMINISTRATIVE after a RolePermission grant exists', async () => {
    const permission = await database.permission.findFirstOrThrow({
      where: { module: 'students', action: 'read' },
    });
    await database.rolePermission.create({
      data: {
        role: 'ADMINISTRATIVE',
        permissionId: permission.id,
      },
    });

    const response = await request(app)
      .get('/probe')
      .set('x-test-role', 'ADMINISTRATIVE');
    expect(response.status).toBe(204);
  });

  it('forbids TEACHER even when an ADMINISTRATIVE grant exists', async () => {
    const permission = await database.permission.findFirstOrThrow({
      where: { module: 'students', action: 'read' },
    });
    await database.rolePermission.create({
      data: {
        role: 'ADMINISTRATIVE',
        permissionId: permission.id,
      },
    });

    const response = await request(app)
      .get('/probe')
      .set('x-test-role', 'TEACHER');
    expect(response.status).toBe(403);
  });
});
