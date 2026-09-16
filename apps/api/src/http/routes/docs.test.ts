import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { isApiDocsEnabled } from '../../config/docs-enabled.js';
import { buildOpenApiDocument } from '../openapi/document.js';
import { buildTestApp } from '../../test/build-test-app.js';

const SENSITIVE_PATTERNS = [
  /DATABASE_URL/i,
  /AUTH_SECRET/i,
  /postgresql:\/\//i,
  /SUPERADMIN_PASSWORD/i,
  /passwordHash/i,
  /change-me-locally/,
  /development-only-secret-change-me/,
];

describe('isApiDocsEnabled', () => {
  it('defaults to enabled outside production when unset', () => {
    expect(
      isApiDocsEnabled({ NODE_ENV: 'development', API_DOCS_ENABLED: undefined }),
    ).toBe(true);
    expect(
      isApiDocsEnabled({ NODE_ENV: 'test', API_DOCS_ENABLED: undefined }),
    ).toBe(true);
  });

  it('defaults to disabled in production when unset', () => {
    expect(
      isApiDocsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: undefined }),
    ).toBe(false);
  });

  it('honours an explicit override', () => {
    expect(
      isApiDocsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: true }),
    ).toBe(true);
    expect(
      isApiDocsEnabled({ NODE_ENV: 'development', API_DOCS_ENABLED: false }),
    ).toBe(false);
  });
});

describe('OpenAPI document', () => {
  it('is a valid OpenAPI 3 document with core metadata and paths', () => {
    const doc = buildOpenApiDocument();

    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBe('Academia API');
    expect(doc.info.version).toBeTruthy();
    expect(Object.keys(doc.paths).length).toBeGreaterThan(20);

    for (const path of [
      '/health',
      '/auth/login',
      '/auth/me',
      '/students',
      '/teachers',
      '/courses',
      '/groups',
      '/schedule-options',
      '/classes',
      '/classes/calendar',
      '/classes/{id}/attendance',
      '/classes/{id}/notes',
      '/groups/{id}/classes/generate',
    ]) {
      expect(doc.paths).toHaveProperty(path);
    }

    expect(doc.components.securitySchemes.sessionCookie).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'academia_session',
    });
  });

  it('does not embed secrets or sensitive infrastructure values', () => {
    const serialized = JSON.stringify(buildOpenApiDocument());

    for (const pattern of SENSITIVE_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
  });
});

describe('GET /openapi.json', () => {
  it('returns 200 with a usable OpenAPI document when docs are enabled', async () => {
    const { app } = await buildTestApp();

    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.info).toMatchObject({ title: 'Academia API' });
    expect(response.body.paths['/health']).toBeDefined();
    expect(response.body.paths['/auth/login']).toBeDefined();
    expect(response.body.paths['/classes/calendar']).toBeDefined();
  });

  it('returns 404 when docs are disabled', async () => {
    const { app } = await buildTestApp({ docsEnabled: false });

    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(404);
  });
});

describe('GET /docs', () => {
  it('returns 200 Swagger UI when docs are enabled', async () => {
    const { app } = await buildTestApp();

    const response = await request(app).get('/docs/');

    expect(response.status).toBe(200);
    expect(response.text).toMatch(/swagger/i);
  });

  it('returns 404 when docs are disabled', async () => {
    const { app } = await buildTestApp({ docsEnabled: false });

    const response = await request(app).get('/docs/');

    expect(response.status).toBe(404);
  });
});
