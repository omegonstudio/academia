import type { MetadataRoute } from 'next';
import { publicRoutes, site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `${site.url}${route.path === '/' ? '' : route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
