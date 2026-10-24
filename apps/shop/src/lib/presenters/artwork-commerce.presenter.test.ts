import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
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

  it("reports a sold-out edition even if sale state is price on application", () => {
    const soldOutPoa = artwork({
      saleState: "price_on_application",
      availability: { totalEditions: 24, state: "sold_out" },
    });
    expect(resolveArtworkUnavailableReason(soldOutPoa)).toBe("edition_sold_out");
  });

  it("offers no purchase or enquiry path for an edition without a price", () => {
    const poaEdition = artwork({ saleState: "price_on_application", printPricePence: null });
    expect(isArtworkPurchasable(poaEdition)).toBe(false);
    expect(resolveArtworkUnavailableReason(poaEdition)).toBeNull();
  });

  it("reports sold works as sold", () => {
    const sold = artwork({
      saleState: "sold",
      printPricePence: null,
    });
    expect(resolveArtworkUnavailableReason(sold)).toBe("sold");
  });
});
