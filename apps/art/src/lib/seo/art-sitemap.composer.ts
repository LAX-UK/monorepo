import { ARTWORK_MEDIUM_LANDINGS } from "@/lib/catalogue/artwork-catalogue-params";
import { editorialPageHref } from "@/lib/editorial/editorial-page-routes";
import { venueHref } from "@/lib/editorial/editorial-pages.composer";
import type { ArtCataloguePort, ArtEditorialPort } from "@/lib/ports";
import type { MetadataRoute } from "next";

type SitemapEntry = MetadataRoute.Sitemap[number];

export type ArtSitemapServices = {
  catalogue: Pick<ArtCataloguePort, "listArtworks" | "listArtists">;
  editorial: Pick<ArtEditorialPort, "listVenues" | "listExhibitions" | "listStories" | "listPages">;
};

const PAGE_SIZE = 50;
/** Guards a misbehaving cursor; 400 pages × 50 is far beyond the catalogue. */
const MAX_PAGES = 400;

const STATIC_PATHS = [
  "/artworks",
  ...ARTWORK_MEDIUM_LANDINGS.map((landing) => landing.path),
  "/artists",
  "/exhibitions",
  "/art-hub",
  "/stories",
  "/stories/artists",
  "/stories/podcast",
  "/stories/press",
  "/collector-hub",
  "/contact",
  "/visit",
];

async function collectAll<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor?: string }>,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await fetchPage(cursor);
    items.push(...result.items);
    cursor = result.nextCursor;
    if (!cursor || seen.has(cursor)) break;
    seen.add(cursor);
  }
  return items;
}

function okItems<T>(result: PromiseSettledResult<{ status: string; data?: { items: T[] } }>): T[] {
  if (result.status !== "fulfilled" || result.value.status !== "ok") return [];
  return result.value.data?.items ?? [];
}

function fulfilled<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === "fulfilled" ? result.value : [];
}

/**
 * Every indexable Art URL with `lastmod` where the API records one. A failed source drops only
 * its own family so one outage never empties the sitemap.
 */
export async function composeArtSitemap(
  services: ArtSitemapServices,
  baseUrl: URL,
): Promise<MetadataRoute.Sitemap> {
  const entries = new Map<string, SitemapEntry>();
  const add = (path: string, entry: Omit<SitemapEntry, "url"> = {}) => {
    const url = new URL(path, baseUrl).toString();
    entries.set(url, { url, ...entries.get(url), ...entry });
  };
  const encode = encodeURIComponent;

  add("/", { changeFrequency: "daily", priority: 1 });
  for (const path of STATIC_PATHS) add(path, { changeFrequency: "weekly", priority: 0.8 });

  const { catalogue, editorial } = services;
  const [artworks, artists, venues, current, upcoming, past, stories, pages] =
    await Promise.allSettled([
      collectAll((cursor) =>
        catalogue.listArtworks({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
      ),
      collectAll((cursor) =>
        catalogue.listArtists({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
      ),
      editorial.listVenues(),
      editorial.listExhibitions("current"),
      editorial.listExhibitions("upcoming"),
      editorial.listExhibitions("past"),
      editorial.listStories(),
      editorial.listPages(),
    ]);

  for (const artwork of fulfilled(artworks)) {
    add(`/artworks/${encode(artwork.slug)}`, {
      changeFrequency: "weekly",
      priority: 0.7,
      ...(artwork.updatedAt ? { lastModified: artwork.updatedAt } : {}),
    });
  }
  for (const artist of fulfilled(artists)) {
    add(`/artists/${encode(artist.slug)}`, { changeFrequency: "weekly", priority: 0.6 });
  }
  for (const venue of okItems(venues)) add(venueHref(venue.slug), { priority: 0.6 });
  for (const exhibition of [current, upcoming, past].flatMap(okItems)) {
    add(`/exhibitions/${encode(exhibition.slug)}`, { priority: 0.6 });
  }
  for (const story of okItems(stories)) {
    add(`/stories/${encode(story.slug)}`, {
      priority: 0.6,
      ...(story.updatedAt ? { lastModified: story.updatedAt } : {}),
    });
  }
  for (const page of okItems(pages)) {
    add(editorialPageHref(page.slug), { priority: 0.5, lastModified: page.updatedAt });
  }

  return [...entries.values()];
}
