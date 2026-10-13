import { loadArtStorefrontBaseUrl } from "@/env.server";
import { fetchArtChannelArtists, fetchArtChannelArtworks } from "@/lib/art-catalogue.server";
import { artServices } from "@/lib/art-services.server";
import { venueHref } from "@/lib/editorial/editorial-pages.composer";
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
    ...[
      "/artworks",
      "/artists",
      "/exhibitions",
      "/art-hub",
      "/collector-hub",
      "/collector-hub/101-guide",
      "/how-to-buy",
      "/how-to-sell",
      "/search",
      "/contact",
      "/visit",
    ].map((path) => ({
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

  const editorial = artServices.editorial;
  const editorialLists = await Promise.all([
    editorial.listVenues(),
    ...(["current", "upcoming", "past"] as const).map((status) =>
      editorial.listExhibitions(status),
    ),
    editorial.listStories(),
  ]);
  const [venues, current, upcoming, past, stories] = editorialLists;
  const editorialPaths = [
    ...(venues?.status === "ok" ? venues.data.items.map((v) => venueHref(v.slug)) : []),
    ...[current, upcoming, past].flatMap((list) =>
      list?.status === "ok"
        ? list.data.items.map((e) => `/exhibitions/${encodeURIComponent(e.slug)}`)
        : [],
    ),
    ...(stories?.status === "ok"
      ? stories.data.items.map((story) => `/stories/${encodeURIComponent(story.slug)}`)
      : []),
  ];
  routes.push(
    ...editorialPaths.map((path) => ({
      url: new URL(path, baseUrl).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );

  return routes;
}
