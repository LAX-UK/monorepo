import { salePath } from "@/lib/seo/url";
import type { PressArchiveEntry } from "@auction/types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rssPubDate(entry: PressArchiveEntry): string {
  const published = entry.item.publishedAt;
  if (published) {
    const d = new Date(`${published}T12:00:00Z`);
    if (Number.isFinite(d.getTime())) return d.toUTCString();
  }
  const fallback = entry.sale.endTime ?? entry.sale.updatedAt;
  return fallback.toUTCString();
}

function rssGuid(entry: PressArchiveEntry): string {
  return `${entry.sale.id}:${entry.item.url}`;
}

function rssCategory(entry: PressArchiveEntry): string | null {
  if (entry.item.mentionType) return entry.item.mentionType;
  const published = entry.item.publishedAt;
  if (published) {
    const year = published.slice(0, 4);
    if (/^\d{4}$/.test(year)) return year;
  }
  return null;
}

function rssItemDescription(entry: PressArchiveEntry, siteUrl: string): string {
  const saleUrl = `${siteUrl}${salePath(entry.sale)}`;
  const parts = [`Related sale: ${entry.sale.title}`, `${saleUrl}#press`];
  if (entry.item.excerpt) parts.push(entry.item.excerpt);
  return parts.join(" · ");
}

export function buildPressRssFeed(opts: {
  siteUrl: string;
  siteName: string;
  entries: PressArchiveEntry[];
  lastUpdated?: Date | null;
  /** Max items in the feed (default 200). */
  limit?: number;
}): string {
  const hubUrl = `${opts.siteUrl}/press`;
  const feedUrl = `${opts.siteUrl}/press/feed.xml`;
  const itemLimit = opts.limit ?? 200;
  const lastBuildDate =
    opts.lastUpdated != null ? opts.lastUpdated.toUTCString() : new Date().toUTCString();
  const items = opts.entries
    .slice(0, itemLimit)
    .map((entry) => {
      const title = escapeXml(`${entry.item.headline} · ${entry.item.outletName}`);
      const link = escapeXml(entry.item.url);
      const description = escapeXml(rssItemDescription(entry, opts.siteUrl));
      const category = rssCategory(entry);
      const categoryXml = category ? `<category>${escapeXml(category)}</category>` : "";
      return `<item>
  <title>${title}</title>
  <link>${link}</link>
  <guid isPermaLink="false">${escapeXml(rssGuid(entry))}</guid>
  <pubDate>${rssPubDate(entry)}</pubDate>
  <description>${description}</description>
  ${categoryXml}
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${opts.siteName} press coverage`)}</title>
    <link>${escapeXml(hubUrl)}</link>
    <description>${escapeXml(`Curated press coverage from ${opts.siteName} sales.`)}</description>
    <language>en-gb</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
}
