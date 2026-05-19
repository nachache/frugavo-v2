import type { MetadataRoute } from "next";
import { ALL_ARTICLES } from "@/lib/learn";

const BASE = "https://frugavo.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/learn`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const articleRoutes: MetadataRoute.Sitemap = ALL_ARTICLES.map((a) => ({
    url: `${BASE}/learn/${a.slug}`,
    lastModified: new Date(a.updated ?? a.published),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...articleRoutes];
}
