import type { MaterialAllowedMimeType } from '@academia/shared';

/**
 * Magic-byte sniffing for FILE materials at complete time.
 *
 * HeadObject alone is not enough — clients can spoof Content-Type on PUT.
 * We read a small prefix via Range GET and match signatures.
 *
 * Limitation: audio/mp4 (and some MPEG variants) share container families;
 * we accept ftyp brands that indicate audio-capable MP4/M4A. Full deep
 * parsing of every codec is out of scope; spoofed containers that pass
 * these signatures could still be uploaded — antivirus is Stage-later.
 */
export function matchesMimeMagicBytes(
  mimeType: MaterialAllowedMimeType,
  prefix: Buffer,
): boolean {
  if (prefix.length === 0) return false;

  switch (mimeType) {
    case 'application/pdf':
      return prefix.subarray(0, 5).toString('ascii') === '%PDF-';

    case 'image/jpeg':
      return (
        prefix.length >= 3 &&
        prefix[0] === 0xff &&
        prefix[1] === 0xd8 &&
        prefix[2] === 0xff
      );

    case 'image/png':
      return (
        prefix.length >= 8 &&
        prefix[0] === 0x89 &&
        prefix[1] === 0x50 &&
        prefix[2] === 0x4e &&
        prefix[3] === 0x47 &&
        prefix[4] === 0x0d &&
        prefix[5] === 0x0a &&
        prefix[6] === 0x1a &&
        prefix[7] === 0x0a
      );

    case 'image/webp':
      return (
        prefix.length >= 12 &&
        prefix.subarray(0, 4).toString('ascii') === 'RIFF' &&
        prefix.subarray(8, 12).toString('ascii') === 'WEBP'
      );

    case 'audio/wav':
      return (
        prefix.length >= 12 &&
        prefix.subarray(0, 4).toString('ascii') === 'RIFF' &&
        prefix.subarray(8, 12).toString('ascii') === 'WAVE'
      );

    case 'audio/ogg':
      return prefix.subarray(0, 4).toString('ascii') === 'OggS';

    case 'audio/mpeg':
      // ID3 tag or MPEG frame sync.
      if (prefix.subarray(0, 3).toString('ascii') === 'ID3') return true;
      return (
        prefix.length >= 2 &&
        prefix[0] === 0xff &&
        (prefix[1]! & 0xe0) === 0xe0
      );

    case 'audio/mp4': {
      // ISO BMFF: size(4) + 'ftyp' at offset 4.
      if (prefix.length < 12) return false;
      if (prefix.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
      const brand = prefix.subarray(8, 12).toString('ascii');
      const allowed = new Set([
        'M4A ',
        'M4B ',
        'mp41',
        'mp42',
        'isom',
        'iso2',
        'MSNV',
      ]);
      return allowed.has(brand);
    }

    default:
      return false;
  }
}

/** Bytes to fetch for magic checks (covers WebP/WAV header + ftyp). */
export const MATERIAL_MAGIC_PREFIX_BYTES = 64;
