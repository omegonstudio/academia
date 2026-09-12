import { describe, expect, it } from 'vitest';
import { parseCookies, serializeCookie } from './cookies.js';

describe('parseCookies', () => {
  it('returns an empty jar when the header is absent', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it('parses multiple cookies', () => {
    expect(parseCookies('a=1; b=2')).toEqual({ a: '1', b: '2' });
  });

  it('keeps base64url and JWT values intact', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl-_';

    expect(parseCookies(`academia_session=${token}`)).toEqual({
      academia_session: token,
    });
  });

  it('decodes percent-encoded values', () => {
    expect(parseCookies('name=a%40b.com')).toEqual({ name: 'a@b.com' });
  });

  it('ignores malformed segments', () => {
    expect(parseCookies('novalue; =orphan; good=1')).toEqual({ good: '1' });
  });
});

describe('serializeCookie', () => {
  it('marks the session cookie HttpOnly, Lax and path-scoped', () => {
    const header = serializeCookie('academia_session', 'token', {
      secure: false,
    });

    expect(header).toContain('academia_session=token');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).not.toContain('Secure');
  });

  it('adds Secure when requested', () => {
    const header = serializeCookie('academia_session', 'token', { secure: true });

    expect(header).toContain('Secure');
  });

  it('emits an immediate expiry when clearing', () => {
    const header = serializeCookie('academia_session', '', {
      secure: false,
      maxAgeSeconds: 0,
    });

    expect(header).toContain('Max-Age=0');
    expect(header).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  });

  it('round-trips through the parser', () => {
    const header = serializeCookie('session', 'a@b/c', { secure: false });
    const value = header.split(';')[0] ?? '';

    expect(parseCookies(value)).toEqual({ session: 'a@b/c' });
  });
});
