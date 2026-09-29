import type { MetadataRoute } from 'next';
import { privateRoutePrefixes, site } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: privateRoutePrefixes.map((prefix) => `${prefix}/`),
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
