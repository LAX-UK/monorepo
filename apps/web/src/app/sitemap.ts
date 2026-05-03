import { fetchArtistIdsForSitemap } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { fetchSalesIdsForSitemap } from "@/lib/data/http/sales.server";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

const STATIC_PATHS = [
  "",
  "/search",
  "/archive",
  "/login",
  "/register",
  "/forgot-password",
  "/about",
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
    reader.list({ status: "active", limit: 500, offset: 0, sort: "endingAsc" }),
    reader.list({ status: "ended", limit: 500, offset: 0, sort: "endedDesc" }),
  ]);
  const seen = new Set<string>();
  const lots: MetadataRoute.Sitemap = [];
  for (const a of [...active, ...ended]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const images = a.images?.filter(Boolean).slice(0, 3);
    lots.push({
      url: `${base}/artwork/${a.id}`,
      lastModified: a.endTime,
      changeFrequency: a.status === "active" ? "hourly" : "monthly",
      priority: a.status === "active" ? 0.9 : 0.5,
      ...(images && images.length > 0 ? { images } : {}),
    });
  }

  const [saleIds, artistIds] = await Promise.all([
    fetchSalesIdsForSitemap(),
    fetchArtistIdsForSitemap(),
  ]);
  const sales: MetadataRoute.Sitemap = saleIds.map((id) => ({
    url: `${base}/sales/${id}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.65,
  }));
  const artists: MetadataRoute.Sitemap = artistIds.map((id) => ({
    url: `${base}/artist/${id}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...sales, ...artists, ...lots];
}
