import type { SaleLotsPage, SaleShell } from "@/lib/data/http/sales.server";
import type { SaleroomSecondaryData } from "@/lib/marketing/saleroom-page-data.service";
import { buildSaleroomPageVM } from "@/lib/marketing/saleroom-page.vm";
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

const shell: SaleShell = { sale: baseSale };

const lotsPage: SaleLotsPage = {
  items: [baseLot],
  total: 1,
  limit: 40,
  offset: 0,
  sort: "lot",
};

const secondary: SaleroomSecondaryData = {
  follow: { isFollowing: false },
  relatedSales: [],
  kycSummary: null,
  kycUnavailable: false,
  watchedLotIds: new Set<string>(),
  telephoneBooking: null,
};

describe("buildSaleroomPageVM", () => {
  it("builds without throwing for minimal sale shell", () => {
    const vm = buildSaleroomPageVM({
      shell,
      lotsPage,
      filteredLots: [baseLot],
      secondary,
      query: {
        pageRaw: undefined,
        catalogSearch: "",
        catalogSort: "lot",
        statusFilter: null,
        isCatalogLoadAll: false,
        pageNum: 1,
        layoutViewRaw: "grid",
        urlView: "grid",
      },
      layoutView: "grid",
      session: null,
      actingMemberships: null,
      orgModuleEnabled: false,
      mySaleRegs: [],
      registeredBidderCount: null,
      initialSaleroomStatus: { status: "none", currentLotId: null },
      categoryLabel: null,
      categoryLabels: [],
      now: new Date("2026-01-15T12:00:00Z"),
    });

    expect(vm.sale.id).toBe("sale-1");
    expect(vm.heroVM.title).toBe("Evening Sale");
    expect(vm.lotVMs).toHaveLength(1);
    expect(vm.lotVMs[0]?.title).toBe("Untitled Study");
  });
});
