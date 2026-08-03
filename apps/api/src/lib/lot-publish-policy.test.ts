import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { assertLotPublishable } from "./lot-publish-policy.js";

const categoryId = "00000000-0000-4000-8000-0000000000c0";
const futureStart = new Date(Date.now() + 86_400_000);
const futureEnd = new Date(Date.now() + 172_800_000);
const pastStart = new Date(Date.now() - 86_400_000);

function mkSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: "Sale",
    description: null,
    coverImages: [],
    categoryId,
    deliveryMode: "online",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    heroPresentation: "cover",
    heroVideoUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    startTime: futureStart,
    endTime: futureEnd,
    previewStartTime: null,
    status: "scheduled",
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mkLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    saleId: null,
    lotNumber: 1,
    sellerId: "s1",
    title: "Lot",
    description: "Catalogue text",
    medium: null,
    dimensions: null,
    images: ["img/a.jpg"],
    categoryId,
    auctionType: "english",
    startingPrice: "1",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: futureStart,
    endTime: futureEnd,
    status: "draft",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

describe("assertLotPublishable", () => {
  it("allows onsite lot with stale past times when sale window is future", () => {
    const sale = mkSale({ deliveryMode: "onsite" });
    const lot = mkLot({
      saleId: sale.id,
      startTime: pastStart,
      endTime: new Date(pastStart.getTime() + 3_600_000),
    });
    const result = assertLotPublishable(lot, { sale, requireCatalogue: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.timing.alignedPatch).toBeDefined();
      expect(result.timing.startTime.getTime()).toBe(sale.startTime.getTime());
      expect(result.timing.endTime.getTime()).toBe(sale.endTime.getTime());
    }
  });

  it("skips future-start gate for onsite lots", () => {
    const sale = mkSale({ deliveryMode: "onsite" });
    const lot = mkLot({
      saleId: sale.id,
      startTime: pastStart,
      endTime: pastStart,
    });
    const result = assertLotPublishable(lot, { sale });
    expect(result.ok).toBe(true);
  });

  it("rejects individual publish when sale is still draft", () => {
    const sale = mkSale({ status: "draft" });
    const lot = mkLot({ saleId: sale.id });
    const result = assertLotPublishable(lot, { sale });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("use_sale_publish");
    }
  });

  it("allows sale-level publish checks when rejectDraftSale is false", () => {
    const sale = mkSale({ status: "draft" });
    const lot = mkLot({ saleId: sale.id });
    const result = assertLotPublishable(lot, {
      sale,
      requireCatalogue: false,
      rejectDraftSale: false,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects sale-level publish when lot has no images and catalogue is required", () => {
    const sale = mkSale({ status: "draft" });
    const lot = mkLot({ saleId: sale.id, images: [] });
    const result = assertLotPublishable(lot, {
      sale,
      requireCatalogue: true,
      rejectDraftSale: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("image");
    }
  });
});
