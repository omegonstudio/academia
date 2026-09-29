import { describe, expect, it } from 'vitest';
import { upstreamApiPath } from './api-proxy';

describe('upstreamApiPath', () => {
  it('maps ordinary API segments without an /api prefix', () => {
    expect(upstreamApiPath(['auth', 'me'])).toBe('/auth/me');
    expect(upstreamApiPath(['students', '1'])).toBe('/students/1');
  });

  it('keeps a trailing slash on the Swagger docs root', () => {
    expect(upstreamApiPath(['docs'])).toBe('/docs/');
  });

  it('forwards Swagger asset paths under /docs', () => {
    expect(upstreamApiPath(['docs', 'swagger-ui.css'])).toBe(
      '/docs/swagger-ui.css',
    );
  });
});
