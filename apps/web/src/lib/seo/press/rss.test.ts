import type { PressArchiveEntry } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildPressRssFeed } from "./rss.js";

const entry: PressArchiveEntry = {
  sale: {
    id: "sale-1",
    title: "Evening Sale",
    status: "ended",
    deliveryMode: "onsite",
    endTime: new Date("2026-06-01T18:00:00.000Z"),
    updatedAt: new Date("2026-06-02T10:00:00.000Z"),
  },
  item: {
    url: "https://example.com/story",
    headline: "Record results",
    outletName: "Example",
    publishedAt: "2026-06-02",
    excerpt: 'Tom & Jerry said "wow"',
    mentionType: "feature",
  },
};

describe("buildPressRssFeed", () => {
  it("escapes XML and includes atom self link", () => {
    const xml = buildPressRssFeed({
      siteUrl: "https://lax.bid",
      siteName: "LAX.BID",
      entries: [entry],
      lastUpdated: new Date("2026-06-03T12:00:00.000Z"),
    });
    expect(xml).toContain('rel="self"');
    expect(xml).toContain("https://example.com/story");
    expect(xml).toContain("Record results");
    expect(xml).toContain("Tom &amp; Jerry said &quot;wow&quot;");
    expect(xml).toContain("<lastBuildDate>");
    expect(xml).toContain("<ttl>60</ttl>");
    expect(xml).toContain("Related sale: Evening Sale");
    expect(xml).toContain("#press");
    expect(xml).toContain("<category>feature</category>");
  });
});
