import type { MetadataRoute } from 'next';
import {
  listPublishedOnlineCourseSlugs,
  publicRoutes,
  site,
} from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: `${site.url}${route.path === '/' ? '' : route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const slugs = await listPublishedOnlineCourseSlugs();
  const courseEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${site.url}/cursos/${encodeURIComponent(slug)}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...courseEntries];
}
