import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  mapLotToCardVM,
  mapSaleToHeroVM,
  mapSaleToOverviewVM,
  mapSaleToRelatedVM,
} from "./mappers";

const baseSale: Sale = {
  id: "sale-1",
  title: "Evening Sale",
  description: "Curated highlights",
  coverImages: ["https://cdn/image.jpg"],
  categoryId: null,
  deliveryMode: "hybrid",
  streamUrl: "https://example.com/stream",
  status: "scheduled",
  startTime: new Date("2026-06-01T18:00:00Z"),
  endTime: new Date("2026-06-01T21:00:00Z"),
  previewStartTime: null,
  buyerPremiumRate: "0.25",
  terms: null,
  createdBy: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseLot: Lot = {
  id: "lot-1",
  saleId: "sale-1",
  lotNumber: 7,
  sellerId: "seller-1",
  title: "Untitled Study",
  description: null,
  medium: null,
  dimensions: null,
  images: ["https://cdn/lot.jpg"],
  categoryId: "cat-1",
  auctionType: "english",
  startingPrice: "100",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "450",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 60_000,
  dutchLastDecrementAt: null,
  startTime: new Date("2026-06-01T18:00:00Z"),
  endTime: new Date("2026-06-01T21:00:00Z"),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {
    estimate: { low: "500", high: "800", currency: "USD" },
  },
};

const now = new Date("2026-01-15T12:00:00Z");

describe("mapSaleToHeroVM", () => {
  it("emits onsite / hybrid / online tags and live-stream tag when streamUrl set", () => {
    const vm = mapSaleToHeroVM(baseSale, { totalLots: 12, shareUrl: "/sales/sale-1", now });
    expect(vm.tags).toContain("Hybrid");
    expect(vm.tags).toContain("Live stream");
    expect(vm.itemsLabel).toBe("12 lots");
    expect(vm.dateLine).toBeTruthy();
  });

  it("marks active sales as live and suppresses bidding-starts label", () => {
    const vm = mapSaleToHeroVM(
      { ...baseSale, status: "active" },
      { totalLots: 1, shareUrl: "/sales/sale-1", now },
    );
    expect(vm.isLive).toBe(true);
    expect(vm.biddingStartsLabel).toBeNull();
    expect(vm.itemsLabel).toBe("1 lot");
    expect(vm.biddingStartsShort).toBeNull();
    expect(vm.registrationClosesShort).toBeNull();
  });

  it("does not show a separate registration row (no registrationEnd on Sale)", () => {
    const vm = mapSaleToHeroVM(baseSale, { totalLots: 1, shareUrl: "/sales/sale-1", now });
    expect(vm.registrationClosesShort).toBeNull();
    expect(vm.biddingStartsShort).toBeTruthy();
  });
});

describe("mapSaleToOverviewVM", () => {
  it("maps sale fields and category label", () => {
    const vm = mapSaleToOverviewVM(baseSale, { lotsTotal: 5, categoryLabel: "Contemporary" });
    expect(vm.lotsLabel).toBe("5 lots");
    expect(vm.categoryLabel).toBe("Contemporary");
    expect(vm.buyerPremiumLabel).toBe("25%");
    expect(vm.formatLabel).toBe("Hybrid");
    expect(vm.showLiveStream).toBe(false);
  });
});

describe("mapLotToCardVM", () => {
  it("includes estimate value and owner detection", () => {
    const vm = mapLotToCardVM(baseLot, { viewerUserId: "seller-1", now, initialWatching: false });
    expect(vm.lotLabel).toBe("Lot 7");
    expect(vm.estimateValue).toBeTruthy();
    expect(vm.viewerOwnsLot).toBe(true);
    expect(vm.isLive).toBe(true);
  });

  it("returns null estimate when marketing details absent", () => {
    const vm = mapLotToCardVM({ ...baseLot, marketingDetails: {} }, { viewerUserId: null, now });
    expect(vm.estimateValue).toBeNull();
    expect(vm.viewerOwnsLot).toBe(false);
  });

  it("labels final bid when lot has ended", () => {
    const vm = mapLotToCardVM({ ...baseLot, status: "ended" }, { viewerUserId: null, now });
    expect(vm.currentBidLabel).toBe("Final bid");
    expect(vm.closingLabel).toBeNull();
    expect(vm.isLive).toBe(false);
  });
});

describe("mapSaleToRelatedVM", () => {
  it("labels onsite/online/hybrid auctions distinctly", () => {
    expect(mapSaleToRelatedVM({ ...baseSale, deliveryMode: "online" }, 10).kindLabel).toBe(
      "Online auction",
    );
    expect(mapSaleToRelatedVM({ ...baseSale, deliveryMode: "onsite" }, 10).kindLabel).toBe(
      "Live auction",
    );
    expect(mapSaleToRelatedVM({ ...baseSale, deliveryMode: "hybrid" }, 10).kindLabel).toBe(
      "Hybrid auction",
    );
  });

  it("pluralises item count", () => {
    expect(mapSaleToRelatedVM(baseSale, 1).itemsLabel).toBe("1 lot");
    expect(mapSaleToRelatedVM(baseSale, 3).itemsLabel).toBe("3 lots");
  });
});
