import { SITE_NAME } from "@/lib/brand";
import { getServerPressArchiveReader } from "@/lib/data/http/press.server";
import { buildPressRssFeed } from "@/lib/seo/press/rss";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 300;

export async function GET() {
  const reader = getServerPressArchiveReader();
  const { data, meta } = await reader.list({ limit: 200 });
  const xml = buildPressRssFeed({
    siteUrl: getSiteUrl(),
    siteName: SITE_NAME,
    entries: data,
    lastUpdated: meta.lastUpdated,
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
