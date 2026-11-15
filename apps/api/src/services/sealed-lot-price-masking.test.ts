import type { Bid, Lot, PublicLotView, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { DashboardQueryService } from "./dashboard-query.service.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import { SaleListReadService } from "./sale-list-read.service.js";
import { SaleService } from "./sale.service.js";
import { UserDashboardReadService } from "./user-dashboard-read.service.js";
import type { WatchlistService } from "./watchlist.service.js";

type Viewer = { role?: string; staffRole?: string | null } | undefined;

const SALE_ID = "s1";
const anonymous: Viewer = undefined;
const client: Viewer = { role: "client" };
const auctionManager: Viewer = { role: "staff", staffRole: "auction_manager" };

function sale(): Sale {
  return {
    id: SALE_ID,
    title: "Sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "online",
    allowOnlineBidsBeforeGoLive: true,
    streamUrl: null,
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
    startTime: new Date(),
    endTime: new Date(Date.now() + 86_400_000),
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function lot(id: string, overrides: Partial<Lot> = {}): Lot {
  return {
    id,
    saleId: SALE_ID,
    lotNumber: 1,
    title: `Lot ${id}`,
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c1000001-0000-4000-8000-000000000001",
    auctionType: "sealed",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "5000.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(Date.now() + 86_400_000),
    status: "active",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

const sealed = () => lot("sealed");
const english = () => lot("english", { auctionType: "english" });
const endedSealed = () => lot("ended", { status: "ended" });

function pricesById(lots: { id: string; currentPrice: string }[]) {
  return Object.fromEntries(lots.map((l) => [l.id, l.currentPrice]));
}

function saleService(lots: Lot[]) {
  const saleRepo = { findById: vi.fn().mockResolvedValue(sale()) } as unknown as ISaleRepository;
  const lotRepo = {
    findBySaleId: vi.fn().mockResolvedValue(lots),
    listCatalogLotsBySalePage: vi.fn().mockResolvedValue({ items: lots, total: lots.length }),
  } as unknown as ILotRepository;
  return new SaleService({
    saleRepo,
    lotRepo,
    jobScheduler: null,
    resolvePlatformCatalogLegalEntityId: async () => null,
  });
}

describe("sealed lot price masking on sale reads", () => {
  const lots = () => [sealed(), english(), endedSealed()];

  it.each([
    ["anonymous", anonymous],
    ["client", client],
  ])("sale detail hides active sealed price (%s)", async (_label, viewer) => {
    const r = await saleService(lots()).getSaleDetailForPublicApi(SALE_ID, undefined, viewer);
    expect(pricesById(r?.data.lots ?? [])).toEqual({
      sealed: "100.00",
      english: "5000.00",
      ended: "5000.00",
    });
  });

  it("sale detail keeps real sealed price for auction staff", async () => {
    const r = await saleService(lots()).getSaleDetailForPublicApi(
      SALE_ID,
      undefined,
      auctionManager,
    );
    expect(pricesById(r?.data.lots ?? []).sealed).toBe("5000.00");
  });

  it("sale lots page hides active sealed price for the public only", async () => {
    const opts = { limit: 10, offset: 0, sort: "lot" as const };
    const pub = await saleService(lots()).listSaleLotsPageForPublicApi(SALE_ID, opts, anonymous);
    expect(pricesById(pub?.data.items ?? [])).toEqual({
      sealed: "100.00",
      english: "5000.00",
      ended: "5000.00",
    });
    const staff = await saleService(lots()).listSaleLotsPageForPublicApi(
      SALE_ID,
      opts,
      auctionManager,
    );
    expect(pricesById(staff?.data.items ?? []).sealed).toBe("5000.00");
  });

  it("sale list preview lots hide active sealed price for the public only", async () => {
    const make = () =>
      new SaleListReadService(
        { list: vi.fn(async () => [sale()]) } as never,
        {
          countLotsBySaleIds: vi.fn(async () => new Map([[SALE_ID, 3]])),
          findPreviewLotsBySaleIds: vi.fn(async () => lots()),
        } as never,
        { resolveManyUnique: vi.fn(async () => new Map()) } as never,
        {
          lookupByKeys: vi.fn(async () => new Map()),
          buildGalleryImages: vi.fn(async () => []),
          buildGalleryImagesWithLookup: vi.fn(async () => []),
        } as never,
      );
    const pub = await make().listForPublicApi({ limit: 20, offset: 0 }, anonymous);
    expect(pricesById(pub.data[0]?.previewLots ?? [])).toEqual({
      sealed: "100.00",
      english: "5000.00",
      ended: "5000.00",
    });
    const staff = await make().listForPublicApi({ limit: 20, offset: 0 }, auctionManager);
    expect(pricesById(staff.data[0]?.previewLots ?? []).sealed).toBe("5000.00");
  });
});

describe("sealed lot price masking on dashboard reads", () => {
  function dashboard() {
    const rows = () =>
      [sealed(), english()].map((l) => ({ bid: { id: `b-${l.id}` } as Bid, lot: l }));
    const dashboardQuery = {
      listBidsWithLotsForBidder: vi.fn(async () => rows()),
    } as unknown as DashboardQueryService;
    const watchlistService = {
      listWithLots: vi.fn(async () =>
        rows().map((r) => ({
          watchlistId: `w-${r.lot.id}`,
          lotId: r.lot.id,
          createdAt: new Date(),
          lot: r.lot,
        })),
      ),
    } as unknown as WatchlistService;
    return new UserDashboardReadService(
      dashboardQuery,
      watchlistService,
      { resolveManyUnique: vi.fn(async () => new Map()) } as never,
      { findByIds: vi.fn(async () => [sale()]) },
    );
  }

  function figures(rows: { lot: Lot | PublicLotView | null }[]) {
    return Object.fromEntries(
      rows.map((r) => [
        r.lot?.id,
        {
          currentPrice: r.lot?.currentPrice,
          hammer: r.lot?.checkoutPricing?.hammerMajor,
          total: r.lot?.checkoutPricing?.totalMajor,
        },
      ]),
    );
  }

  it("my bids and watchlist derive no figure from the hidden sealed price (client)", async () => {
    for (const rows of [
      await dashboard().listBidsForUser("user-1", client),
      await dashboard().listWatchlistForUser("user-1", {}, client),
    ]) {
      expect(figures(rows)).toEqual({
        sealed: { currentPrice: "100.00", hammer: "100.00", total: "125.00" },
        english: { currentPrice: "5000.00", hammer: "5000.00", total: "6250.00" },
      });
    }
  });

  it("my bids and watchlist keep real sealed figures for auction staff", async () => {
    for (const rows of [
      await dashboard().listBidsForUser("user-1", auctionManager),
      await dashboard().listWatchlistForUser("user-1", {}, auctionManager),
    ]) {
      expect(figures(rows).sealed).toEqual({
        currentPrice: "5000.00",
        hammer: "5000.00",
        total: "6250.00",
      });
    }
  });
});
