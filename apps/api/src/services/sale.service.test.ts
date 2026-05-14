import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { LotError } from "../lib/errors.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import { SaleService } from "./sale.service.js";

describe("SaleService.create", () => {
  it("creates sale then nested lots with saleId", async () => {
    const createdSale: Sale = {
      id: "s-new",
      title: "Evening",
      description: null,
      coverImages: [],
      categoryId: null,
      deliveryMode: "onsite",
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
      status: "draft",
      startTime: new Date(),
      endTime: new Date(),
      previewStartTime: null,
      buyerPremiumRate: "0.25",
      buyerPremiumTiers: null,
      terms: null,
      createdBy: "admin-1",
      createdByLegalEntityId: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saleRepo: ISaleRepository = {
      create: vi.fn().mockResolvedValue(createdSale),
    } as unknown as ISaleRepository;

    const createdLot: Lot = {
      id: "lot-1",
      saleId: "s-new",
      lotNumber: 1,
      sellerId: "seller-1",
      sellerLegalEntityId: "seller-1",
      title: "Work",
      description: null,
      medium: null,
      dimensions: null,
      images: [],
      categoryId: "c1000001-0000-4000-8000-000000000001",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(),
      endTime: new Date(),
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };

    const lotCreate = vi.fn().mockResolvedValue(createdLot);
    const lotRepo: ILotRepository = {
      create: lotCreate,
    } as unknown as ILotRepository;

    const jobs = null as ILotJobScheduler | null;
    const svc = new SaleService({ saleRepo, lotRepo, jobScheduler: jobs });

    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(Date.now() + 172_800_000);
    await svc.create("admin-1", {
      title: "Evening",
      startTime: start,
      endTime: end,
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
      lots: [
        {
          sellerId: "seller-1",
          title: "Work",
          categoryId: "c1000001-0000-4000-8000-000000000001",
          categoryIds: ["c1000001-0000-4000-8000-000000000001"],
          auctionType: "english",
          startingPrice: "100",
          startTime: start,
          endTime: end,
        },
      ],
    });

    expect(saleRepo.create).toHaveBeenCalled();
    expect(lotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: "s-new",
        sellerLegalEntityId: "seller-1",
        title: "Work",
      }),
    );
  });

  it("rejects nested non-english lots when English-only mode is on", async () => {
    const createdSale: Sale = {
      id: "s-new",
      title: "Evening",
      description: null,
      coverImages: [],
      categoryId: null,
      deliveryMode: "onsite",
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
      status: "draft",
      startTime: new Date(),
      endTime: new Date(),
      previewStartTime: null,
      buyerPremiumRate: "0.25",
      buyerPremiumTiers: null,
      terms: null,
      createdBy: "admin-1",
      createdByLegalEntityId: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const saleRepo: ISaleRepository = {
      create: vi.fn().mockResolvedValue(createdSale),
    } as unknown as ISaleRepository;
    const lotCreate = vi.fn();
    const lotRepo: ILotRepository = {
      create: lotCreate,
    } as unknown as ILotRepository;
    const svc = new SaleService({
      saleRepo,
      lotRepo,
      jobScheduler: null,
      englishOnlyAuctions: true,
    });
    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(Date.now() + 172_800_000);
    await expect(
      svc.create("admin-1", {
        title: "Evening",
        startTime: start,
        endTime: end,
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
        lots: [
          {
            sellerId: "seller-1",
            title: "Work",
            categoryId: "c1000001-0000-4000-8000-000000000001",
            categoryIds: ["c1000001-0000-4000-8000-000000000001"],
            auctionType: "dutch",
            startingPrice: "100",
            startTime: start,
            endTime: end,
          },
        ],
      }),
    ).rejects.toThrow(LotError);
    expect(lotCreate).not.toHaveBeenCalled();
  });
});

describe("SaleService.getSaleDetailForPublicApi", () => {
  it("returns null when sale missing", async () => {
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ISaleRepository;
    const lotRepo = {} as unknown as ILotRepository;
    const svc = new SaleService({ saleRepo, lotRepo, jobScheduler: null });
    const r = await svc.getSaleDetailForPublicApi("missing", undefined);
    expect(r).toBeNull();
  });

  it("includes viewer follow flag when user id provided", async () => {
    const sale: Sale = {
      id: "s1",
      title: "T",
      description: null,
      coverImages: [],
      categoryId: null,
      deliveryMode: "onsite",
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
      endTime: new Date(),
      previewStartTime: null,
      buyerPremiumRate: "0.25",
      buyerPremiumTiers: null,
      terms: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([]),
    } as unknown as ILotRepository;
    const follow = { isFollowing: vi.fn().mockResolvedValue(true) };
    const svc = new SaleService({
      saleRepo,
      lotRepo,
      jobScheduler: null,
      saleFollowReader: follow,
    });
    const r = await svc.getSaleDetailForPublicApi("s1", "user-1");
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.data.viewer.isFollowing).toBe(true);
    expect(follow.isFollowing).toHaveBeenCalledWith("user-1", "s1");
  });
});
