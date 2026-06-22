import { salePressJsonLd } from "@/lib/seo/structured-data";
import type { Sale, SalePressItem } from "@auction/types";
import { describe, expect, it } from "vitest";

const baseSale = {
  id: "sale-1",
  title: "Evening Sale",
  description: null,
  coverImages: [],
  categoryId: null,
  deliveryMode: "onsite",
  allowOnlineBidsBeforeGoLive: false,
  streamUrl: null,
  locationName: null,
  locationAddress: null,
  locationMapUrl: null,
  locationAddressLine1: null,
  locationAddressLine2: null,
  locationCity: null,
  locationCounty: null,
  locationPostcode: null,
  locationCountry: null,
  status: "active",
  startTime: new Date("2026-06-01T10:00:00.000Z"),
  endTime: new Date("2026-06-01T18:00:00.000Z"),
  previewStartTime: null,
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
  terms: null,
  createdByLegalEntityId: "le-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-06-01"),
} satisfies Sale;

const items: SalePressItem[] = [
  {
    url: "https://dailymail.co.uk/article/123",
    headline: "Stunning result at LAX",
    outletName: "Daily Mail",
    publishedAt: "2026-06-02",
    excerpt: "A record evening.",
    mentionType: "feature",
  },
  {
    url: "https://hellomag.com/article/456",
    headline: "Stars attend LAX gala",
    outletName: "Hello Magazine",
  },
];

describe("salePressJsonLd", () => {
  it("returns null for empty items", () => {
    expect(salePressJsonLd(baseSale, [])).toBeNull();
  });

  it("emits ItemList type", () => {
    const ld = salePressJsonLd(baseSale, items);
    expect(ld?.["@type"]).toBe("ItemList");
    expect(ld?.["@context"]).toBe("https://schema.org");
  });

  it("emits correct number of ListItem entries", () => {
    const ld = salePressJsonLd(baseSale, items);
    const list = ld?.itemListElement as unknown[];
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(2);
  });

  it("each entry is a ListItem with a nested NewsArticle", () => {
    const ld = salePressJsonLd(baseSale, items);
    const list = ld?.itemListElement as Array<Record<string, unknown>>;
    expect(list[0]?.["@type"]).toBe("ListItem");
    expect(list[0]?.position).toBe(1);
    const article = list[0]?.item as Record<string, unknown>;
    expect(article?.["@type"]).toBe("NewsArticle");
    expect(article?.headline).toBe("Stunning result at LAX");
    expect(article?.url).toBe("https://dailymail.co.uk/article/123");
    expect(article?.datePublished).toBe("2026-06-02");
    expect(article?.description).toBe("A record evening.");
  });

  it("includes publisher Organization with outletName", () => {
    const ld = salePressJsonLd(baseSale, items);
    const list = ld?.itemListElement as Array<Record<string, unknown>>;
    const article = list[0]?.item as Record<string, unknown>;
    const publisher = article?.publisher as Record<string, unknown>;
    expect(publisher?.["@type"]).toBe("Organization");
    expect(publisher?.name).toBe("Daily Mail");
  });

  it("omits datePublished and description when absent", () => {
    const ld = salePressJsonLd(baseSale, items);
    const list = ld?.itemListElement as Array<Record<string, unknown>>;
    const article2 = list[1]?.item as Record<string, unknown>;
    expect(article2?.datePublished).toBeUndefined();
    expect(article2?.description).toBeUndefined();
  });
});
