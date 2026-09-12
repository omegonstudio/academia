import type { MetadataRoute } from 'next';
import { publicRoutes, site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Only public routes are listed; /login and /dashboard are intentionally absent.
  return publicRoutes.map((route) => ({
    url: new URL(route.path, site.url).toString(),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
