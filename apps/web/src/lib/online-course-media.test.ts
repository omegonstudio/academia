import { describe, expect, it } from 'vitest';
import {
  formatLessonAssetKinds,
  formatOnlineCoursePrice,
  lessonHasListedContent,
  onlineLessonAssetKindLabels,
  videoEmbedUrl,
} from './online-course-media.js';

describe('lessonHasListedContent', () => {
  it('is false when there are no asset kinds', () => {
    expect(lessonHasListedContent([])).toBe(false);
  });

  it('is true when at least one kind is listed', () => {
    expect(lessonHasListedContent(['VIDEO'])).toBe(true);
    expect(lessonHasListedContent(['TEXT', 'LINK'])).toBe(true);
  });
});

describe('formatLessonAssetKinds', () => {
  it('marks lessons without assets as pending', () => {
    expect(formatLessonAssetKinds([])).toBe('Contenido pendiente');
  });

  it('joins unique kind labels', () => {
    expect(formatLessonAssetKinds(['VIDEO', 'DOCUMENT'])).toBe(
      `${onlineLessonAssetKindLabels.VIDEO} · ${onlineLessonAssetKindLabels.DOCUMENT}`,
    );
  });
});

describe('formatOnlineCoursePrice', () => {
  it('shows Gratis for free or missing amounts', () => {
    expect(formatOnlineCoursePrice(null, 'ARS')).toBe('Gratis');
    expect(formatOnlineCoursePrice('0', 'ARS')).toBe('Gratis');
    expect(formatOnlineCoursePrice('150000', null)).toBe('Gratis');
  });

  it('formats major units with currency', () => {
    expect(formatOnlineCoursePrice('150000', 'ARS')).toBe('ARS 1500');
    expect(formatOnlineCoursePrice('150050', 'USD')).toBe('USD 1500,50');
  });
});

describe('videoEmbedUrl', () => {
  it('builds YouTube and Vimeo embeds over https', () => {
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=abc123XYZ_-')).toBe(
      'https://www.youtube.com/embed/abc123XYZ_-',
    );
    expect(videoEmbedUrl('https://youtu.be/abc123XYZ_-')).toBe(
      'https://www.youtube.com/embed/abc123XYZ_-',
    );
    expect(videoEmbedUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
  });

  it('rejects non-https or unknown hosts', () => {
    expect(videoEmbedUrl('http://www.youtube.com/watch?v=abc')).toBeNull();
    expect(videoEmbedUrl('https://example.com/video.mp4')).toBeNull();
  });
});
