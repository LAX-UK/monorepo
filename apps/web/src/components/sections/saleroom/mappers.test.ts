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
  allowOnlineBidsBeforeGoLive: false,
  streamUrl: "https://example.com/stream",
  heroPresentation: "cover",
  heroVideoUrl: null,
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
const defaultHeroOpts = { shareUrl: "/s", now };

describe("mapSaleToHeroVM", () => {
  it("maps hero fields for scheduled onsite sales with stream", () => {
    const vm = mapSaleToHeroVM(baseSale, {
      totalLots: 12,
      shareUrl: "/sales/evening-sale/sale-1",
      now,
    });
    expect(vm.itemsLabel).toBe("12 lots");
    expect(vm.dateLine).toContain("THELAX SALEROOM");
  });

  it("marks active sales as live without a duplicate bidding sidebar line", () => {
    const vm = mapSaleToHeroVM(
      { ...baseSale, status: "active" },
      { totalLots: 1, shareUrl: "/sales/evening-sale/sale-1", now },
    );
    expect(vm.isLive).toBe(true);
    expect(vm.itemsLabel).toBe("1 lot");
    expect(vm.biddingStartsShort).toBeNull();
    expect(vm.rightColumnLabel).toBeNull();
    expect(vm.registrationClosesShort).toBeNull();
  });

  it("uses previewStartTime for the left preview cell when set", () => {
    const vm = mapSaleToHeroVM(
      { ...baseSale, previewStartTime: new Date("2026-05-20T12:00:00Z") },
      { totalLots: 1, shareUrl: "/sales/evening-sale/sale-1", now },
    );
    expect(vm.leftColumnLabel).toBe("Preview opens");
    expect(vm.registrationClosesShort).toBeTruthy();
  });

  it("scheduled: bidding row without preview", () => {
    const vm = mapSaleToHeroVM(baseSale, {
      totalLots: 1,
      shareUrl: "/sales/evening-sale/sale-1",
      now,
    });
    expect(vm.registrationClosesShort).toBeNull();
    expect(vm.leftColumnLabel).toBeNull();
    expect(vm.biddingStartsShort).toBeTruthy();
    expect(vm.rightColumnLabel).toBe("Bidding starts");
  });

  it("hides preview lines for active sales even when previewStartTime is set", () => {
    const vm = mapSaleToHeroVM(
      {
        ...baseSale,
        status: "active",
        previewStartTime: new Date("2026-05-20T12:00:00Z"),
      },
      { totalLots: 1, shareUrl: "/sales/evening-sale/sale-1", now },
    );
    expect(vm.leftColumnLabel).toBeNull();
    expect(vm.registrationClosesShort).toBeNull();
  });

  it("passes sale status on hero VM for registry badges", () => {
    const scheduled = mapSaleToHeroVM(baseSale, { totalLots: 1, ...defaultHeroOpts });
    expect(scheduled.status).toBe("scheduled");

    const active = mapSaleToHeroVM(
      { ...baseSale, status: "active" },
      { totalLots: 1, ...defaultHeroOpts },
    );
    expect(active.status).toBe("active");

    const ended = mapSaleToHeroVM(
      { ...baseSale, status: "ended" },
      { totalLots: 1, ...defaultHeroOpts },
    );
    expect(ended.status).toBe("ended");
  });

  it("maps draft and cancelled sale status on hero VM", () => {
    const draft = mapSaleToHeroVM(
      { ...baseSale, status: "draft" },
      { totalLots: 1, ...defaultHeroOpts },
    );
    expect(draft.status).toBe("draft");

    const cancelled = mapSaleToHeroVM(
      { ...baseSale, status: "cancelled" },
      { totalLots: 1, ...defaultHeroOpts },
    );
    expect(cancelled.status).toBe("cancelled");
  });
});

describe("mapSaleToOverviewVM", () => {
  it("maps sale fields and category label", () => {
    const vm = mapSaleToOverviewVM(baseSale, {
      categoryLabel: "Contemporary",
      categoryLabels: ["Contemporary"],
    });
    expect(vm.status).toBe("scheduled");
    expect(vm.categoryLabel).toBe("Contemporary");
    expect(vm.buyerPremiumLabel).toBe("25%");
    expect(vm.formatLabel).toBe("In-person");
    expect(vm.showSalePageStream).toBe(true);
    expect(vm.streamPresentation?.sectionHeading).toBe("Live stream");
    expect(vm.tags).toEqual([]);
    expect(vm.saleTitle).toBe("Evening Sale");
    expect(vm.streamPosterUrl).toBe("https://cdn/image.jpg");
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
    const vm = mapSaleToOverviewVM(sale, { categoryLabel: null, categoryLabels: [] });
    expect(vm.showLocation).toBe(true);
    expect(vm.locationAddressLines).toEqual([
      "34 New Bond Street",
      "London",
      "W1A 2AA",
      "United Kingdom",
    ]);
    expect(vm.resolvedMapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(vm.resolvedMapUrl).toContain("Sotheby");
    expect(vm.locationEmbedUrl).toMatch(/^https:\/\/www\.google\.com\/maps\?q=/);
    expect(vm.locationEmbedUrl).toContain("output=embed");
  });

  it("hides location for online sales even when fields are populated", () => {
    const sale: Sale = {
      ...baseSale,
      deliveryMode: "online",
      allowOnlineBidsBeforeGoLive: false,
      locationAddressLine1: "Should not show",
    };
    const vm = mapSaleToOverviewVM(sale, { categoryLabel: null, categoryLabels: [] });
    expect(vm.showLocation).toBe(false);
  });

  it("shows recording stream on sale page when sale has ended with stream URL", () => {
    const sale = { ...baseSale, status: "ended" as const };
    const vm = mapSaleToOverviewVM(sale, { categoryLabel: null, categoryLabels: [] });
    expect(vm.showSalePageStream).toBe(true);
    expect(vm.streamPresentation?.sectionHeading).toBe("Saleroom recording");
    expect(vm.streamPresentation?.embedCtaLabel).toBe("Watch recording");
    expect(vm.streamPresentation?.overviewTag).toBe("Saleroom recording");
  });

  it("hides stream on sale page when ended sale has no stream URL", () => {
    const sale = { ...baseSale, status: "ended" as const, streamUrl: null };
    const vm = mapSaleToOverviewVM(sale, { categoryLabel: null, categoryLabels: [] });
    expect(vm.showSalePageStream).toBe(false);
    expect(vm.streamPresentation).toBeNull();
  });

  it("shows location for hybrid sales with venue info", () => {
    const sale: Sale = {
      ...baseSale,
      deliveryMode: "hybrid",
      locationName: "TheLax Saleroom",
      locationAddressLine1: "12 King Street",
      locationCity: "London",
    };
    const vm = mapSaleToOverviewVM(sale, { categoryLabel: null, categoryLabels: [] });
    expect(vm.showLocation).toBe(true);
  });

  it("maps tiered buyer premium label", () => {
    const sale: Sale = {
      ...baseSale,
      buyerPremiumTiers: [{ hammerThresholdMinor: 0, rate: "0.1500" }],
    };
    const vm = mapSaleToOverviewVM(sale, { categoryLabel: null, categoryLabels: [] });
    expect(vm.buyerPremiumLabel).toBe("Tiered — see table");
    expect(vm.buyerPremiumTiers).toHaveLength(1);
  });

  it("uses an explicit locationMapUrl override when provided", () => {
    const sale: Sale = {
      ...baseSale,
      locationMapUrl: "https://maps.example.com/custom-pin",
      locationAddressLine1: "1 Test Street",
      locationCity: "London",
      locationPostcode: "SW1Y 6QU",
    };
    const vm = mapSaleToOverviewVM(sale, { categoryLabel: null, categoryLabels: [] });
    expect(vm.resolvedMapUrl).toBe("https://maps.example.com/custom-pin");
  });
});

describe("aggregateSaleEstimateTotal", () => {
  it("sums estimates when all lots are loaded", async () => {
    const { aggregateSaleEstimateTotal } = await import("./mappers");
    const lots = [
      baseLot,
      {
        ...baseLot,
        id: "lot-2",
        marketingDetails: { estimate: { low: "200", high: "400", currency: "USD" } },
      },
    ];
    const label = aggregateSaleEstimateTotal(lots, { loadedCount: 2, totalLots: 2 });
    expect(label).toBeTruthy();
    expect(label).toContain("700");
  });

  it("returns null when catalogue is paginated", async () => {
    const { aggregateSaleEstimateTotal } = await import("./mappers");
    expect(aggregateSaleEstimateTotal([baseLot], { loadedCount: 1, totalLots: 10 })).toBeNull();
  });
});

describe("computeEndedSaleSummary", () => {
  it("aggregates sold and hammer total for ended sales", async () => {
    const { computeEndedSaleSummary } = await import("./mappers");
    const summary = computeEndedSaleSummary(
      { ...baseSale, status: "ended" },
      [
        { ...baseLot, status: "ended", winnerId: "buyer-1", currentPrice: "1000.00" },
        { ...baseLot, id: "lot-2", status: "ended", winnerId: null, currentPrice: "0.00" },
      ],
      { loadedCount: 2, totalLots: 2 },
    );
    expect(summary?.soldCount).toBe(1);
    expect(summary?.unsoldCount).toBe(1);
    expect(summary?.hammerTotalLabel).toBeTruthy();
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
      "Online Auction",
    );
    expect(mapSaleToRelatedVM({ ...baseSale, deliveryMode: "onsite" }, 10).kindLabel).toBe(
      "In-person Auction",
    );
  });

  it("pluralises item count", () => {
    expect(mapSaleToRelatedVM(baseSale, 1).itemsLabel).toBe("1 lot");
    expect(mapSaleToRelatedVM(baseSale, 3).itemsLabel).toBe("3 lots");
  });
});
