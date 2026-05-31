import {
  ARTIST_DIRECTORY_PRESETS,
  DECADE_SEGMENTS,
  KIND_SEGMENTS,
  NATIONALITY_SEGMENTS,
} from "@/lib/artists/directory-presets";
import { fetchArtistsForSitemap } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { fetchSalesForSitemap } from "@/lib/data/http/sales.server";
import { isIndexingAllowedAtBuildTime } from "@/lib/seo/is-indexing-allowed";
import { artistPath, lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

const STATIC_PATHS = [
  "",
  "/search",
  "/archive",
  "/about",
  "/buy",
  "/sell",
  "/contact",
  "/legal",
  "/privacy",
  "/cookies",
  "/terms",
  "/shipping",
  "/faq",
  "/sales",
] as const;

const LETTER_SEGMENTS = "abcdefghijklmnopqrstuvwxyz".split("").concat(["other"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexingAllowedAtBuildTime()) return [];

  const base = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.6,
  }));

  const reader = await getServerLotReader();
  const [active, ended] = await Promise.all([
    reader.list({ status: "active", limit: 500, offset: 0, sort: "endingAsc" }).catch(() => []),
    reader.list({ status: "ended", limit: 500, offset: 0, sort: "endedDesc" }).catch(() => []),
  ]);
  const seen = new Set<string>();
  const lots: MetadataRoute.Sitemap = [];
  for (const a of [...active, ...ended]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const images = a.images?.filter(Boolean).slice(0, 3);
    lots.push({
      url: `${base}${lotPath(a)}`,
      lastModified: a.endTime,
      changeFrequency: a.status === "active" ? "hourly" : "monthly",
      priority: a.status === "active" ? 0.9 : 0.5,
      ...(images && images.length > 0 ? { images } : {}),
    });
  }

  const [saleRows, artistRows] = await Promise.all([
    fetchSalesForSitemap(),
    fetchArtistsForSitemap(),
  ]);
  const sales: MetadataRoute.Sitemap = saleRows.map((sale) => ({
    url: `${base}${salePath(sale)}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.65,
  }));
  const artists: MetadataRoute.Sitemap = artistRows.map((artist) => ({
    url: `${base}${artistPath(artist)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Directory slices: each canonical preset path is its own indexable page,
  // so we surface them to crawlers. We use `now` as `lastModified` since the
  // listing reflects whatever artists are currently approved — fine-grained
  // per-slice timestamps would require aggregate queries we don't run yet.
  // `ARTIST_DIRECTORY_PRESETS` already covers `/artists`, `/artists/featured`,
  // `/artists/living`, `/artists/historical`, and the four kind paths, so we
  // only spread it once and add letter + decade slices on top.
  // Kind directory slices beyond the four curated presets (designers, mints,
  // authors, producers, …). The curated kind paths are already in
  // `ARTIST_DIRECTORY_PRESETS`, so filter those out to avoid duplicates.
  const curatedKindPaths = new Set(
    ARTIST_DIRECTORY_PRESETS.map((p) => p.canonicalPath).filter((path) =>
      path.startsWith("/artists/kind/"),
    ),
  );
  const extraKindSlices = KIND_SEGMENTS.map((slug) => `/artists/kind/${slug}`).filter(
    (path) => !curatedKindPaths.has(path),
  );

  const directorySlices: MetadataRoute.Sitemap = [
    ...ARTIST_DIRECTORY_PRESETS.map((p) => ({
      url: `${base}${p.canonicalPath}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: p.id === "all" ? 0.7 : 0.6,
    })),
    ...extraKindSlices.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.55,
    })),
    ...NATIONALITY_SEGMENTS.map((n) => ({
      url: `${base}/artists/nationality/${n.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.55,
    })),
    ...DECADE_SEGMENTS.map((decade) => ({
      url: `${base}/artists/decade/${decade}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...LETTER_SEGMENTS.map((letter) => ({
      url: `${base}/artists/letter/${letter}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];

  return [...staticRoutes, ...sales, ...artists, ...directorySlices, ...lots];
}
