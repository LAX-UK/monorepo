import type { LotPageSecondaryData, LotPageShellData } from "@/lib/marketing/lot-page-data.service";
import { buildLotPageViewModel } from "@/lib/marketing/lot-page-vm";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";

const baseSale: Sale = {
  id: "sale-1",
  title: "Evening Sale",
  description: "Curated highlights",
  coverImages: ["https://cdn/image.jpg"],
  categoryId: null,
  deliveryMode: "online",
  allowOnlineBidsBeforeGoLive: true,
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
  status: "active",
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
  medium: "Oil on canvas",
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

const shell: LotPageShellData = {
  auction: baseLot,
  session: null,
  initialBids: [],
  seller: null,
  catalogArtist: null,
  relatedRaw: [],
  watchlist: [],
  saleBundle: { sale: baseSale, lots: [baseLot] },
  kycSummary: null,
  kycUnavailable: false,
  lotDocuments: [],
  initialAutoBidSettings: null,
  watcherCount: 0,
};

const secondary: LotPageSecondaryData = {
  actingCtx: {
    acting: null,
    memberships: [],
    impersonation: null,
    bootstrapFailed: false,
  },
  mySaleRegs: [],
  buyerConditionReportRequest: null,
  telephoneBookingForOnsite: null,
  initialSaleroomStatus: { status: "none", currentLotId: null },
  orgModuleEnabled: false,
};

describe("buildLotPageViewModel", () => {
  it("builds without throwing for minimal online lot shell", () => {
    const vm = buildLotPageViewModel({
      shell,
      secondary,
      searchParams: {},
      serverNow: Date.parse("2026-01-15T12:00:00Z"),
    });

    expect(vm.auction.id).toBe("lot-1");
    expect(vm.lotNavVM.saleTitle).toBe("Evening Sale");
    expect(vm.summarySeed.title).toBe("Untitled Study");
    expect(vm.marketingBlocks.length).toBeGreaterThan(0);
  });

  it("keeps SSR bid bar active for a hybrid lot live in saleroom past end time", () => {
    const hybridSale: Sale = { ...baseSale, deliveryMode: "hybrid" };
    const onBlockLot: Lot = {
      ...baseLot,
      startTime: new Date("2026-06-01T18:00:00Z"),
      endTime: new Date("2026-06-01T21:00:00Z"),
      status: "active",
    };

    const vm = buildLotPageViewModel({
      shell: {
        ...shell,
        auction: onBlockLot,
        saleBundle: { sale: hybridSale, lots: [onBlockLot] },
      },
      secondary: {
        ...secondary,
        initialSaleroomStatus: { status: "live", currentLotId: "lot-1" },
      },
      searchParams: {},
      // Well past the catalog end time — clerk session still running.
      serverNow: Date.parse("2026-06-02T12:00:00Z"),
    });

    expect(vm.initialMarketingBidBarActive).toBe(true);
    expect(vm.lotTimerState.kind).toBe("closed");
  });
});
