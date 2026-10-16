import type { FinanceCurrency, OnlineLessonAssetKind } from '@academia/shared';

export const onlineLessonAssetKindLabels: Record<OnlineLessonAssetKind, string> =
  {
    VIDEO: 'Video',
    DOCUMENT: 'Documento',
    TEXT: 'Texto',
    LINK: 'Enlace',
  };

/** True when the public outline already lists at least one asset kind. */
export function lessonHasListedContent(
  assetKinds: readonly OnlineLessonAssetKind[],
): boolean {
  return assetKinds.length > 0;
}

export function formatLessonAssetKinds(
  assetKinds: readonly OnlineLessonAssetKind[],
): string {
  if (assetKinds.length === 0) return 'Contenido pendiente';
  return [...new Set(assetKinds)]
    .map((kind) => onlineLessonAssetKindLabels[kind])
    .join(' · ');
}

/** Build an embeddable iframe URL for common video hosts; otherwise null. */
export function videoEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null

    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id =
        url.searchParams.get('v') ||
        (url.pathname.startsWith('/embed/')
          ? url.pathname.split('/')[2]
          : url.pathname.startsWith('/shorts/')
            ? url.pathname.split('/')[2]
            : null)
      return id ? `https://www.youtube.com/embed/${id}` : null
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      const id =
        host === 'player.vimeo.com' && parts[0] === 'video'
          ? parts[1]
          : parts[0]
      return id && /^\d+$/.test(id)
        ? `https://player.vimeo.com/video/${id}`
        : null
    }

    return null
  } catch {
    return null
  }
}

export function formatOnlineCoursePrice(
  amountMinor: string | null,
  currency: FinanceCurrency | null,
): string {
  if (!amountMinor || amountMinor === '0' || !currency) return 'Gratis'
  const padded = amountMinor.padStart(3, '0')
  const whole = padded.slice(0, -2).replace(/^0+(?=\d)/, '') || '0'
  const cents = padded.slice(-2)
  const major = cents === '00' ? whole : `${whole},${cents}`
  return `${currency} ${major}`
}
