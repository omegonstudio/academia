import { healthResponseSchema } from '@academia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../test/build-test-app.js';

describe('GET /health', () => {
  it('reports 200 and ok when every dependency is usable', async () => {
    const { app } = await buildTestApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(response.body)).toMatchObject({
      status: 'ok',
      service: 'academia-api',
      environment: 'test',
      checks: { configuration: 'pass', database: 'pass' },
    });
  });

  it('reports 503 and identifies the database as the failing check', async () => {
    const { app } = await buildTestApp({ databaseReachable: false });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      checks: { configuration: 'pass', database: 'fail' },
    });
  });

  it('distinguishes a configuration problem from a database outage', async () => {
    const { app } = await buildTestApp({
      configurationIssues: ['AUTH_SECRET still holds the development sample value'],
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      checks: { configuration: 'fail', database: 'pass' },
    });
  });

  it('does not disclose why the configuration is invalid', async () => {
    const { app } = await buildTestApp({
      configurationIssues: ['AUTH_SECRET still holds the development sample value'],
    });

    const response = await request(app).get('/health');
    const body = JSON.stringify(response.body);

    expect(body).not.toContain('AUTH_SECRET');
    expect(body).not.toContain('postgresql://');
    expect(Object.keys(response.body)).toEqual([
      'status',
      'service',
      'environment',
      'uptimeSeconds',
      'checks',
    ]);
  });
});

describe('unknown routes', () => {
  it('answers 404 in the standard error envelope', async () => {
    const { app } = await buildTestApp();

    const response = await request(app).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Unknown endpoint.' },
    });
  });
});
