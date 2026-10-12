import { loadArtStorefrontBaseUrl } from "@/env.server";
import { fetchArtChannelArtists, fetchArtChannelArtworks } from "@/lib/art-catalogue.server";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

async function fetchAllArtworks() {
  const items: Awaited<ReturnType<typeof fetchArtChannelArtworks>>["items"] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await fetchArtChannelArtworks({
      limit: 50,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (cursor && seen.has(cursor)) break;
    if (cursor) seen.add(cursor);
  } while (cursor);
  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = loadArtStorefrontBaseUrl();
  const routes: MetadataRoute.Sitemap = [
    { url: new URL("/", baseUrl).toString(), changeFrequency: "daily", priority: 1 },
    ...["/artworks", "/artists", "/search", "/contact", "/visit"].map((path) => ({
      url: new URL(path, baseUrl).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  const [artworks, artists] = await Promise.allSettled([
    fetchAllArtworks(),
    fetchArtChannelArtists({ limit: 50 }),
  ]);
  if (artworks.status === "fulfilled") {
    routes.push(
      ...artworks.value.map((item) => ({
        url: new URL(`/artworks/${encodeURIComponent(item.slug)}`, baseUrl).toString(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    );
  }
  if (artists.status === "fulfilled") {
    routes.push(
      ...artists.value.items.map((item) => ({
        url: new URL(`/artists/${encodeURIComponent(item.slug)}`, baseUrl).toString(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    );
  }

  return routes;
}
