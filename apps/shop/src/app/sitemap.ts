import { loadShopStorefrontBaseUrl } from "@/lib/ecosystem/product-directory.server";
import {
  fetchPublicArtists,
  fetchPublicArtworks,
  fetchPublicCategories,
} from "@/lib/shop-api.server";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

async function fetchAllPublicArtworks() {
  const items: Awaited<ReturnType<typeof fetchPublicArtworks>>["items"] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await fetchPublicArtworks({
      limit: 50,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (cursor && seenCursors.has(cursor)) {
      throw new Error("Shop API returned a repeated artwork cursor");
    }
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = loadShopStorefrontBaseUrl();
  const routes: MetadataRoute.Sitemap = [
    {
      url: new URL("/", baseUrl).toString(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...["/artworks", "/artists", "/categories"].map((path) => ({
      url: new URL(path, baseUrl).toString(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  const [artworks, artists, categories] = await Promise.allSettled([
    fetchAllPublicArtworks(),
    fetchPublicArtists({ limit: 50 }),
    fetchPublicCategories({ limit: 50 }),
  ]);
  if (artworks.status === "fulfilled") {
    routes.push(
      ...artworks.value.map((artwork) => ({
        url: new URL(`/artworks/${encodeURIComponent(artwork.slug)}`, baseUrl).toString(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    );
  }
  if (artists.status === "fulfilled") {
    routes.push(
      ...artists.value.items.map((artist) => ({
        url: new URL(`/artists/${encodeURIComponent(artist.slug)}`, baseUrl).toString(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    );
  }
  if (categories.status === "fulfilled") {
    routes.push(
      ...categories.value.items.map((category) => ({
        url: new URL(`/categories/${encodeURIComponent(category.slug)}`, baseUrl).toString(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    );
  }

  return routes;
}
