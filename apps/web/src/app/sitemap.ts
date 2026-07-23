import {
  ARTIST_DIRECTORY_PRESETS,
  DECADE_SEGMENTS,
  KIND_SEGMENTS,
  NATIONALITY_SEGMENTS,
} from "@/lib/artists/directory-presets";
import { getServerLotReader } from "@/lib/catalog/catalog.server";
import { fetchArtistsForSitemap } from "@/lib/data/http/artist.server";
import { fetchPressHubMeta, getServerPressArchiveReader } from "@/lib/data/http/press.server";
import { fetchSalesForSitemap } from "@/lib/data/http/sales.server";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { isIndexingAllowedAtBuildTime } from "@/lib/seo/is-indexing-allowed";
import { buildPressHubSitemapEntry } from "@/lib/seo/press/sitemap";
import { artistPath, lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

// Generate at request time so the production origin env and live catalogue data
// are available; a build without these produced an empty sitemap.
export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "",
  "/search",
  "/archive",
  "/about",
  "/buy",
  "/sell",
  "/sell/estate",
  "/sell/corporate",
  "/sell/prints",
  "/sell/watches",
  "/sell/motor-cars",
  "/contact",
  "/legal",
  "/privacy",
  "/cookies",
  "/terms",
  "/shipping",
  "/faq",
  "/sales",
  "/press",
] as const;

const LETTER_SEGMENTS = "abcdefghijklmnopqrstuvwxyz".split("").concat(["other"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexingAllowedAtBuildTime()) return [];

  const base = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = STATIC_PATHS.filter((path) => path !== "/press").map(
    (path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? "daily" : "weekly",
      priority: path === "" ? 1 : 0.6,
    }),
  );

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

  const [saleRows, artistRows, pressFreshness, pressMeta] = await Promise.all([
    fetchSalesForSitemap(),
    fetchArtistsForSitemap(),
    getServerPressArchiveReader()
      .getSitemapFreshness()
      .catch(() => []),
    fetchPressHubMeta().catch(() => ({
      total: 0,
      archiveTotal: 0,
      outletCount: 0,
      lastUpdated: null,
      availableYears: [],
    })),
  ]);
  const freshnessBySaleId = new Map(pressFreshness.map((row) => [row.saleId, row]));
  const sales: MetadataRoute.Sitemap = saleRows.map((sale) => {
    const fresh = freshnessBySaleId.get(sale.id);
    const preview = fresh?.previewImageSrc ? resolveMediaSrc(fresh.previewImageSrc) : null;
    return {
      url: `${base}${salePath(sale)}`,
      lastModified: fresh?.lastModified ?? now,
      changeFrequency: "daily" as const,
      priority: 0.65,
      ...(preview ? { images: [preview] } : {}),
    };
  });
  const pressHub = buildPressHubSitemapEntry(base, pressMeta);
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

  return [...staticRoutes, pressHub, ...sales, ...artists, ...directorySlices, ...lots];
}
