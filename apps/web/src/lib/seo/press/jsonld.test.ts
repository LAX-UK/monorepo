import type { PressArchiveEntry } from "@auction/types";
import { describe, expect, it } from "vitest";
import { pressHubJsonLd } from "./jsonld.js";

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
  },
};

describe("pressHubJsonLd", () => {
  it("includes ItemList on canonical unfiltered hub", () => {
    const ld = pressHubJsonLd({
      url: "https://lax.bid/press",
      entries: [entry],
      lastUpdated: new Date("2026-06-03T12:00:00.000Z"),
      totalItems: 42,
      includeItemList: true,
    });
    const mainEntity = ld.mainEntity as Record<string, unknown>;
    expect(mainEntity?.["@type"]).toBe("ItemList");
    expect(mainEntity?.numberOfItems).toBe(42);
  });

  it("omits ItemList on filtered or paginated views", () => {
    const ld = pressHubJsonLd({
      url: "https://lax.bid/press",
      entries: [],
      lastUpdated: null,
      includeItemList: false,
    });
    expect(ld.mainEntity).toBeUndefined();
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.publisher).toBeDefined();
  });
});
