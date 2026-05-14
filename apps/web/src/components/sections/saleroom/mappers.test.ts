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
  deliveryMode: "onsite",
  streamUrl: "https://example.com/stream",
  locationName: "TheLax Saleroom",
  locationAddress: "12 King Street, London",
  locationMapUrl: null,
  locationAddressLine1: null,
  locationAddressLine2: null,
  locationCity: null,
  locationCounty: null,
  locationPostcode: null,
  locationCountry: null,
  status: "scheduled",
  startTime: new Date("2026-06-01T18:00:00Z"),
  endTime: new Date("2026-06-01T21:00:00Z"),
  previewStartTime: null,
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
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
const defaultHeroOpts = { shareUrl: "/s", now, categoryLabel: null as string | null };

describe("mapSaleToHeroVM", () => {
  it("emits onsite / online tags and live-stream tag when streamUrl set", () => {
    const vm = mapSaleToHeroVM(baseSale, {
      totalLots: 12,
      shareUrl: "/sales/evening-sale/sale-1",
      now,
      categoryLabel: null,
    });
    expect(vm.tags).toContain("Onsite");
    expect(vm.tags).toContain("Live stream");
    expect(vm.itemsLabel).toBe("12 lots");
    expect(vm.dateLine).toContain("THELAX SALEROOM");
  });

  it("marks active sales as live and shows a live bidding short label", () => {
    const vm = mapSaleToHeroVM(
      { ...baseSale, status: "active" },
      { totalLots: 1, shareUrl: "/sales/evening-sale/sale-1", now, categoryLabel: null },
    );
    expect(vm.isLive).toBe(true);
    expect(vm.biddingStartsLabel).toBeNull();
    expect(vm.itemsLabel).toBe("1 lot");
    expect(vm.biddingStartsShort).toBe("Live now");
    expect(vm.rightColumnLabel).toBe("Bidding");
    expect(vm.registrationClosesShort).toBeNull();
  });

  it("uses previewStartTime for the left preview cell when set", () => {
    const vm = mapSaleToHeroVM(
      { ...baseSale, previewStartTime: new Date("2026-05-20T12:00:00Z") },
      { totalLots: 1, shareUrl: "/sales/evening-sale/sale-1", now, categoryLabel: null },
    );
    expect(vm.leftColumnLabel).toBe("Preview opens");
    expect(vm.registrationClosesShort).toBeTruthy();
  });

  it("scheduled: bidding row without preview", () => {
    const vm = mapSaleToHeroVM(baseSale, {
      totalLots: 1,
      shareUrl: "/sales/evening-sale/sale-1",
      now,
      categoryLabel: null,
    });
    expect(vm.registrationClosesShort).toBeNull();
    expect(vm.leftColumnLabel).toBeNull();
    expect(vm.biddingStartsShort).toBeTruthy();
    expect(vm.rightColumnLabel).toBe("Bidding starts");
  });

  it("sets statusBadge: scheduled → upcoming, active → live, ended → ended", () => {
    const scheduled = mapSaleToHeroVM(baseSale, { totalLots: 1, ...defaultHeroOpts });
    expect(scheduled.statusBadge).toEqual({ kind: "upcoming", label: "Upcoming Auction" });

    const active = mapSaleToHeroVM(
      { ...baseSale, status: "active" },
      { totalLots: 1, ...defaultHeroOpts },
    );
    expect(active.statusBadge).toEqual({ kind: "live", label: "Live Auction" });

    const ended = mapSaleToHeroVM(
      { ...baseSale, status: "ended" },
      { totalLots: 1, ...defaultHeroOpts },
    );
    expect(ended.statusBadge).toEqual({ kind: "ended", label: "Ended" });
  });

  it("sets statusBadge to null for draft and cancelled", () => {
    const draft = mapSaleToHeroVM(
      { ...baseSale, status: "draft" },
      { totalLots: 1, ...defaultHeroOpts },
    );
    expect(draft.statusBadge).toBeNull();

    const cancelled = mapSaleToHeroVM(
      { ...baseSale, status: "cancelled" },
      { totalLots: 1, ...defaultHeroOpts },
    );
    expect(cancelled.statusBadge).toBeNull();
  });
});

describe("mapSaleToOverviewVM", () => {
  it("maps sale fields and category label", () => {
    const vm = mapSaleToOverviewVM(baseSale, { lotsTotal: 5, categoryLabel: "Contemporary" });
    expect(vm.lotsLabel).toBe("5 lots");
    expect(vm.categoryLabel).toBe("Contemporary");
    expect(vm.buyerPremiumLabel).toBe("25%");
    expect(vm.formatLabel).toBe("On-site");
    expect(vm.showLiveStream).toBe(false);
    expect(vm.showLocation).toBe(true);
    expect(vm.locationName).toBe("TheLax Saleroom");
  });

  it("prefers structured UK address lines and generates a Google Maps URL", () => {
    const sale: Sale = {
      ...baseSale,
      locationAddress: null,
      locationName: "Sotheby's London",
      locationAddressLine1: "34 New Bond Street",
      locationCity: "London",
      locationPostcode: "W1A 2AA",
      locationCountry: "United Kingdom",
    };
    const vm = mapSaleToOverviewVM(sale, { lotsTotal: 1, categoryLabel: null });
    expect(vm.showLocation).toBe(true);
    expect(vm.locationAddressLines).toEqual([
      "34 New Bond Street",
      "London",
      "W1A 2AA",
      "United Kingdom",
    ]);
    expect(vm.resolvedMapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(vm.resolvedMapUrl).toContain("Sotheby");
  });

  it("hides location for online sales even when fields are populated", () => {
    const sale: Sale = {
      ...baseSale,
      deliveryMode: "online",
      locationAddressLine1: "Should not show",
    };
    const vm = mapSaleToOverviewVM(sale, { lotsTotal: 1, categoryLabel: null });
    expect(vm.showLocation).toBe(false);
  });

  it("uses an explicit locationMapUrl override when provided", () => {
    const sale: Sale = {
      ...baseSale,
      locationMapUrl: "https://maps.example.com/custom-pin",
      locationAddressLine1: "1 Test Street",
      locationCity: "London",
      locationPostcode: "SW1Y 6QU",
    };
    const vm = mapSaleToOverviewVM(sale, { lotsTotal: 1, categoryLabel: null });
    expect(vm.resolvedMapUrl).toBe("https://maps.example.com/custom-pin");
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
  it("labels onsite and online auctions distinctly", () => {
    expect(mapSaleToRelatedVM({ ...baseSale, deliveryMode: "online" }, 10).kindLabel).toBe(
      "Online auction",
    );
    expect(mapSaleToRelatedVM({ ...baseSale, deliveryMode: "onsite" }, 10).kindLabel).toBe(
      "Live auction",
    );
  });

  it("pluralises item count", () => {
    expect(mapSaleToRelatedVM(baseSale, 1).itemsLabel).toBe("1 lot");
    expect(mapSaleToRelatedVM(baseSale, 3).itemsLabel).toBe("3 lots");
  });
});
