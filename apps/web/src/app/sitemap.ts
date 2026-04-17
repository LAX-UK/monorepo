import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/search",
    "/archive",
    "/login",
    "/register",
    "/about",
    "/contact",
    "/artist/featured",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.6,
  }));

  const reader = await getServerAuctionReader();
  const active = await reader.list({ status: "active", limit: 500, offset: 0, sort: "endingAsc" });
  const ended = await reader.list({ status: "ended", limit: 500, offset: 0, sort: "endedDesc" });
  const seen = new Set<string>();
  const lots: MetadataRoute.Sitemap = [];
  for (const a of [...active, ...ended]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    lots.push({
      url: `${base}/artwork/${a.id}`,
      lastModified: a.endTime,
      changeFrequency: a.status === "active" ? "hourly" : "monthly",
      priority: a.status === "active" ? 0.9 : 0.5,
    });
  }

  return [...staticRoutes, ...lots];
}
