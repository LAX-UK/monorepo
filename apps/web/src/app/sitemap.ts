import { fetchArtistsForSitemap } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { fetchSalesForSitemap } from "@/lib/data/http/sales.server";
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
  "/terms",
  "/shipping",
  "/artist/featured",
  "/faq",
  "/sales",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    reader
      .list({ status: "active", limit: 500, offset: 0, sort: "endingAsc" })
      .catch(() => []),
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

  return [...staticRoutes, ...sales, ...artists, ...lots];
}
