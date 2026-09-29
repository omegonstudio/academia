import { describe, expect, it } from 'vitest';
import {
  MATERIAL_MAGIC_PREFIX_BYTES,
  matchesMimeMagicBytes,
} from './mime-magic.js';

function pad(prefix: Buffer, min = MATERIAL_MAGIC_PREFIX_BYTES): Buffer {
  if (prefix.length >= min) return prefix;
  return Buffer.concat([prefix, Buffer.alloc(min - prefix.length)]);
}

describe('matchesMimeMagicBytes', () => {
  it('accepts PDF %PDF- signature', () => {
    expect(
      matchesMimeMagicBytes('application/pdf', Buffer.from('%PDF-1.7\n')),
    ).toBe(true);
    expect(
      matchesMimeMagicBytes('application/pdf', Buffer.from('not-a-pdf')),
    ).toBe(false);
  });

  it('accepts JPEG SOI marker', () => {
    expect(
      matchesMimeMagicBytes(
        'image/jpeg',
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      ),
    ).toBe(true);
    expect(
      matchesMimeMagicBytes('image/jpeg', Buffer.from([0xff, 0xd8, 0x00])),
    ).toBe(false);
  });

  it('accepts PNG signature', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    expect(matchesMimeMagicBytes('image/png', png)).toBe(true);
    expect(
      matchesMimeMagicBytes('image/png', Buffer.from('PNGFILE')),
    ).toBe(false);
  });

  it('accepts WEBP RIFF....WEBP', () => {
    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0);
    webp.writeUInt32LE(100, 4);
    webp.write('WEBP', 8);
    expect(matchesMimeMagicBytes('image/webp', pad(webp))).toBe(true);

    const wavAsWebp = Buffer.alloc(12);
    wavAsWebp.write('RIFF', 0);
    wavAsWebp.writeUInt32LE(100, 4);
    wavAsWebp.write('WAVE', 8);
    expect(matchesMimeMagicBytes('image/webp', pad(wavAsWebp))).toBe(false);
  });

  it('accepts WAV RIFF....WAVE', () => {
    const wav = Buffer.alloc(12);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(100, 4);
    wav.write('WAVE', 8);
    expect(matchesMimeMagicBytes('audio/wav', pad(wav))).toBe(true);
    expect(matchesMimeMagicBytes('audio/wav', Buffer.from('OggS'))).toBe(
      false,
    );
  });

  it('accepts OggS signature', () => {
    expect(
      matchesMimeMagicBytes('audio/ogg', Buffer.from('OggS....')),
    ).toBe(true);
    expect(matchesMimeMagicBytes('audio/ogg', Buffer.from('RIFF'))).toBe(
      false,
    );
  });

  it('accepts MPEG ID3 or frame sync', () => {
    expect(
      matchesMimeMagicBytes('audio/mpeg', Buffer.from('ID3....')),
    ).toBe(true);
    expect(
      matchesMimeMagicBytes(
        'audio/mpeg',
        Buffer.from([0xff, 0xfb, 0x90, 0x00]),
      ),
    ).toBe(true);
    expect(
      matchesMimeMagicBytes('audio/mpeg', Buffer.from([0x00, 0x00])),
    ).toBe(false);
  });

  it('accepts audio/mp4 ftyp brands', () => {
    const m4a = Buffer.alloc(12);
    m4a.writeUInt32BE(20, 0);
    m4a.write('ftyp', 4);
    m4a.write('M4A ', 8);
    expect(matchesMimeMagicBytes('audio/mp4', pad(m4a))).toBe(true);

    const isom = Buffer.alloc(12);
    isom.writeUInt32BE(20, 0);
    isom.write('ftyp', 4);
    isom.write('isom', 8);
    expect(matchesMimeMagicBytes('audio/mp4', pad(isom))).toBe(true);

    const badBrand = Buffer.alloc(12);
    badBrand.writeUInt32BE(20, 0);
    badBrand.write('ftyp', 4);
    badBrand.write('qt  ', 8);
    expect(matchesMimeMagicBytes('audio/mp4', pad(badBrand))).toBe(false);

    expect(
      matchesMimeMagicBytes('audio/mp4', Buffer.from('not-ftyp-here')),
    ).toBe(false);
  });

  it('rejects empty prefix for all types', () => {
    expect(matchesMimeMagicBytes('application/pdf', Buffer.alloc(0))).toBe(
      false,
    );
    expect(matchesMimeMagicBytes('image/jpeg', Buffer.alloc(0))).toBe(false);
  });

  it('rejects cross-type mismatches (negatives)', () => {
    expect(
      matchesMimeMagicBytes('application/pdf', Buffer.from([0xff, 0xd8, 0xff])),
    ).toBe(false);
    expect(
      matchesMimeMagicBytes('image/png', Buffer.from('%PDF-1.4')),
    ).toBe(false);
    expect(
      matchesMimeMagicBytes('audio/mpeg', Buffer.from('OggS')),
    ).toBe(false);
  });
});
