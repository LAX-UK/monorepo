import type { PressHubMeta } from "@auction/types";
import type { MetadataRoute } from "next";

export function buildPressHubSitemapEntry(
  siteUrl: string,
  meta: PressHubMeta,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}/press`,
    lastModified: meta.lastUpdated ?? new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  };
}
