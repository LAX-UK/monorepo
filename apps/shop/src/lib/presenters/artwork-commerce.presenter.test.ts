import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  isArtworkPriceEnquiryAvailable,
  isArtworkPurchasable,
  resolveArtworkUnavailableReason,
} from "./artwork-commerce.presenter.js";

const artwork = (overrides: Partial<PublicArtworkDetail> = {}): PublicArtworkDetail => ({
  slug: "warm-basket",
  title: "Warm Basket",
  artistName: "Flora Powers",
  artistSlug: "flora-powers",
  description: null,
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

describe("artwork commerce presenter", () => {
  it("treats purchasable editions as available for basket checkout", () => {
    expect(isArtworkPurchasable(artwork())).toBe(true);
    expect(resolveArtworkUnavailableReason(artwork())).toBeNull();
  });

  it("blocks price enquiry when editions are sold out even if sale state is POA", () => {
    const soldOutPoa = artwork({
      saleState: "price_on_application",
      availability: { totalEditions: 24, state: "sold_out" },
    });
    expect(isArtworkPriceEnquiryAvailable(soldOutPoa)).toBe(false);
    expect(resolveArtworkUnavailableReason(soldOutPoa)).toBe("edition_sold_out");
  });

  it("allows price enquiry for available originals on request", () => {
    const poaOriginal = artwork({
      saleState: "price_on_application",
      eligibleForEditionAllocation: false,
      printPricePence: null,
      availability: { totalEditions: 0, state: "sold_out" },
    });
    expect(isArtworkPriceEnquiryAvailable(poaOriginal)).toBe(true);
    expect(resolveArtworkUnavailableReason(poaOriginal)).toBe("price_enquiry");
  });

  it("does not invite enquiry for sold originals", () => {
    const sold = artwork({
      saleState: "sold",
      eligibleForEditionAllocation: false,
      printPricePence: null,
      availability: { totalEditions: 0, state: "sold_out" },
    });
    expect(isArtworkPriceEnquiryAvailable(sold)).toBe(false);
    expect(resolveArtworkUnavailableReason(sold)).toBe("sold");
  });
});
