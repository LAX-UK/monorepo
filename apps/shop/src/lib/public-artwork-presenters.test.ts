import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { formatEditionAvailabilitySummary } from "./public-artwork-presenters.js";

const summary = (overrides: Partial<PublicArtworkSummary> = {}): PublicArtworkSummary => ({
  slug: "warm-basket",
  title: "Warm Basket",
  artistName: "Flora Powers",
  imageUrl: null,
  saleState: "for_sale",
  dimensions: null,
  yearCreated: null,
  eligibleForEditionAllocation: true,
  printPricePence: 12000,
  availability: { totalEditions: 24, editionsAvailable: 10 },
  ...overrides,
});

describe("formatEditionAvailabilitySummary", () => {
  it("describes edition availability", () => {
    expect(formatEditionAvailabilitySummary(summary())).toBe("10 of 24 editions available");
  });

  it("labels originals without allocation", () => {
    expect(formatEditionAvailabilitySummary(summary({ eligibleForEditionAllocation: false }))).toBe(
      "Original — one of one",
    );
  });

  it("turns zero availability into a shopper-facing sold-out line", () => {
    expect(
      formatEditionAvailabilitySummary(
        summary({ availability: { totalEditions: 24, editionsAvailable: 0 } }),
      ),
    ).toBe("Sold out — all 24 claimed");
    expect(
      formatEditionAvailabilitySummary(
        summary({ availability: { totalEditions: 0, editionsAvailable: 0 } }),
      ),
    ).toBe("Sold out");
  });
});
