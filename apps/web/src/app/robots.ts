import type { MetadataRoute } from 'next';
import { privateRoutePrefixes, site } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private areas are excluded from crawling as well as from indexing.
        disallow: privateRoutePrefixes.map((prefix) => `${prefix}/`),
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
