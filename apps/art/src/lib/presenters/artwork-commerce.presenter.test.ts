import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  formatArtworkMetaLine,
  isArtworkEnquiryAvailable,
  isArtworkSold,
  resolveArtworkPriceLabel,
} from "./artwork-commerce.presenter.js";

const artwork = (overrides: Partial<PublicArtworkSummary> = {}): PublicArtworkSummary => ({
  slug: "warm-basket",
  title: "Warm Basket",
  artistName: "Flora Powers",
  artistSlug: "flora-powers",
  imageUrl: null,
  saleState: "for_sale",
  dimensions: null,
  yearCreated: null,
  medium: null,
  salesChannel: "art",
  eligibleForEditionAllocation: false,
  printPricePence: null,
  availability: { totalEditions: 0, state: "sold_out" },
  ...overrides,
});

describe("artwork commerce presenter", () => {
  it("labels price on application works as Price on request", () => {
    expect(resolveArtworkPriceLabel(artwork({ saleState: "price_on_application" }))).toBe(
      "Price on request",
    );
  });

  it("labels sold originals and fully claimed editions as Sold", () => {
    expect(resolveArtworkPriceLabel(artwork({ saleState: "sold" }))).toBe("Sold");
    const claimed = artwork({
      eligibleForEditionAllocation: true,
      printPricePence: 12000,
      availability: { totalEditions: 24, state: "sold_out" },
    });
    expect(isArtworkSold(claimed)).toBe(true);
    expect(resolveArtworkPriceLabel(claimed)).toBe("Sold");
  });

  it("shows the listed price for priced works", () => {
    expect(resolveArtworkPriceLabel(artwork({ printPricePence: 85000 }))).toBe("£850.00");
  });

  it("falls back to Price on request for unpriced originals", () => {
    expect(resolveArtworkPriceLabel(artwork())).toBe("Price on request");
  });

  it("accepts enquiries for every unsold work", () => {
    expect(isArtworkEnquiryAvailable(artwork())).toBe(true);
    expect(isArtworkEnquiryAvailable(artwork({ saleState: "price_on_application" }))).toBe(true);
    expect(isArtworkEnquiryAvailable(artwork({ saleState: "sold" }))).toBe(false);
  });

  it("joins year, medium, and dimensions with middots", () => {
    expect(
      formatArtworkMetaLine({
        yearCreated: 2024,
        medium: "Oil on canvas",
        dimensions: "40 × 50 cm",
      }),
    ).toBe("2024 · Oil on canvas · 40 × 50 cm");
    expect(formatArtworkMetaLine({ yearCreated: null, medium: null, dimensions: "40 cm" })).toBe(
      "40 cm",
    );
    expect(formatArtworkMetaLine({ yearCreated: null, medium: null, dimensions: null })).toBeNull();
  });
});
