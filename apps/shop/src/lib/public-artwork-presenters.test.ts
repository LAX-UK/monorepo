import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { formatEditionAvailabilitySummary } from "./public-artwork-presenters.js";

const summary = (overrides: Partial<PublicArtworkSummary> = {}): PublicArtworkSummary => ({
  slug: "warm-basket",
  title: "Warm Basket",
  artistName: "Flora Powers",
  artistSlug: "flora-powers",
  imageUrl: null,
  saleState: "for_sale",
  dimensions: null,
  yearCreated: null,
  medium: null,
  salesChannel: "shop",
  eligibleForEditionAllocation: true,
  printPricePence: 12000,
  availability: { totalEditions: 24, state: "available" },
  ...overrides,
});

describe("formatEditionAvailabilitySummary", () => {
  it("describes edition availability", () => {
    expect(formatEditionAvailabilitySummary(summary())).toBe("Limited edition of 24 · Available");
  });

  it("shows a sold-out edition without a count", () => {
    expect(
      formatEditionAvailabilitySummary(
        summary({ availability: { totalEditions: 24, state: "sold_out" } }),
      ),
    ).toBe("Limited edition of 24 · Sold out");
    expect(
      formatEditionAvailabilitySummary(
        summary({ availability: { totalEditions: 0, state: "sold_out" } }),
      ),
    ).toBe("Sold out");
  });
});
