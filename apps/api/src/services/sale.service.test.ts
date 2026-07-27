import type { Database } from "@auction/db";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { IVenueRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale, Venue } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import { transactionRunnerFromDb } from "../test/transaction-runner-from-db.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ISalePublishService } from "./interfaces/sale-publish.js";
import { SaleService, type SaleServiceOptions } from "./sale.service.js";
import { SalePublishService } from "./sale/sale-publish.service.js";

const TEST_ADMIN_USER_ID = "admin-1";
const TEST_PLATFORM_CATALOG_LEGAL_ENTITY_ID = "30000000-0000-4000-9000-000000000001";

async function testResolvePlatformCatalogLegalEntityId(): Promise<string | null> {
  return TEST_PLATFORM_CATALOG_LEGAL_ENTITY_ID;
}

function testRepoFactory(lotRepo: ILotRepository, saleRepo: ISaleRepository): IRepositoryFactory {
  const conn = { lot: lotRepo, bid: {} as never };
  return {
    root: conn,
    forConnection: () => conn,
    forTransaction: () => ({ ...conn, sale: saleRepo, itemSubmission: {} as never }),
    runInTransaction: async <T>(fn: (r: typeof conn, tx: Database) => Promise<T>) =>
      fn(conn, {} as Database),
  } as unknown as IRepositoryFactory;
}

type SaleServiceTestInput = Omit<
  SaleServiceOptions,
  "resolvePlatformCatalogLegalEntityId" | "salePublishService"
> &
  Partial<Pick<SaleServiceOptions, "resolvePlatformCatalogLegalEntityId" | "salePublishService">>;

function testSalePublishService(
  opts: SaleServiceTestInput & Pick<SaleServiceOptions, "saleRepo" | "lotRepo">,
): ISalePublishService {
  return new SalePublishService({
    saleRepo: opts.saleRepo,
    lotRepo: opts.lotRepo,
    jobScheduler: opts.jobScheduler ?? null,
    resolvePlatformCatalogLegalEntityId:
      opts.resolvePlatformCatalogLegalEntityId ?? testResolvePlatformCatalogLegalEntityId,
    imageCleanup: opts.imageCleanup,
    saleFollowReader: opts.saleFollowReader ?? null,
    mediaUrlResolver: opts.mediaUrlResolver,
    catalogueMediaUrlResolver: opts.catalogueMediaUrlResolver ?? opts.mediaUrlResolver,
    mediaAssetEnricher: opts.mediaAssetEnricher,
    englishOnlyAuctions: opts.englishOnlyAuctions ?? false,
    transactionRunner: opts.transactionRunner ?? null,
    domainEventSink: opts.domainEventSink ?? null,
    lotLifecycleRecording: opts.lotLifecycleRecording ?? null,
    legalEntityRepository: opts.legalEntityRepository ?? null,
    venueRepository: opts.venueRepository ?? null,
    enforceIndividualConnectOnPublish: opts.enforceIndividualConnectOnPublish ?? false,
    qrCodeService: opts.qrCodeService ?? null,
    repoFactory: opts.repoFactory ?? null,
  });
}

function saleServiceOpts(overrides: SaleServiceTestInput): SaleServiceOptions {
  const base: SaleServiceTestInput & {
    resolvePlatformCatalogLegalEntityId: SaleServiceOptions["resolvePlatformCatalogLegalEntityId"];
  } = {
    resolvePlatformCatalogLegalEntityId: testResolvePlatformCatalogLegalEntityId,
    ...overrides,
  };
  if (base.transactionRunner && base.lotRepo && base.saleRepo && !base.repoFactory) {
    base.repoFactory = testRepoFactory(base.lotRepo, base.saleRepo);
  }
  const salePublishService = base.salePublishService ?? testSalePublishService(base);
  return {
    ...base,
    salePublishService,
  };
}

function baseSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
    title: "Evening",
    description: null,
    coverImages: ["old-key.jpg"],
    categoryId: null,
    deliveryMode: "onsite",
    allowOnlineBidsBeforeGoLive: false,
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
    status: "scheduled",
    startTime: new Date(Date.now() + 86_400_000),
    endTime: new Date(Date.now() + 172_800_000),
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdBy: "admin-1",
    createdByLegalEntityId: "admin-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SaleService.create", () => {
  it("creates sale then nested lots with saleId", async () => {
    const createdSale: Sale = {
      id: "s-new",
      title: "Evening",
      description: null,
      coverImages: [],
      categoryId: null,
      deliveryMode: "onsite",
      allowOnlineBidsBeforeGoLive: false,
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
      description: "Catalogue description",
      medium: null,
      dimensions: null,
      images: ["img.jpg"],
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
    const svc = new SaleService(saleServiceOpts({ saleRepo, lotRepo, jobScheduler: jobs }));

    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(Date.now() + 172_800_000);
    await svc.create(TEST_ADMIN_USER_ID, {
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

    expect(saleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByLegalEntityId: TEST_PLATFORM_CATALOG_LEGAL_ENTITY_ID,
      }),
    );
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
      allowOnlineBidsBeforeGoLive: false,
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
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
        englishOnlyAuctions: true,
      }),
    );
    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(Date.now() + 172_800_000);
    await expect(
      svc.create(TEST_ADMIN_USER_ID, {
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

  it("rejects create when platform catalog legal entity cannot be resolved", async () => {
    const saleRepo: ISaleRepository = {
      create: vi.fn(),
    } as unknown as ISaleRepository;
    const lotRepo = {} as unknown as ILotRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
        resolvePlatformCatalogLegalEntityId: async () => null,
      }),
    );

    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(Date.now() + 172_800_000);
    await expect(
      svc.create(TEST_ADMIN_USER_ID, {
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
      }),
    ).rejects.toThrow(LotError);
    expect(saleRepo.create).not.toHaveBeenCalled();
  });
});

describe("SaleService.updateDraft", () => {
  it("allows coverImages-only patch on scheduled sale for catalogue.write staff", async () => {
    const sale = baseSale({ status: "scheduled", coverImages: ["old.jpg"] });
    const updated = { ...sale, coverImages: ["new.jpg"] };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn().mockResolvedValue(updated),
    } as unknown as ISaleRepository;
    const enqueueRemovedMany = vi.fn().mockResolvedValue(undefined);
    const imageCleanup = { enqueueRemovedMany } as unknown as ImageCleanupService;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
        imageCleanup,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { coverImages: ["new.jpg"] },
      "catalogue_manager",
    );

    expect(result.isOk()).toBe(true);
    expect(saleRepo.update).toHaveBeenCalledWith(sale.id, { coverImages: ["new.jpg"] });
    expect(enqueueRemovedMany).toHaveBeenCalledWith(["old.jpg"], ["new.jpg"]);
  });

  it("clears coverImages with empty array on scheduled sale", async () => {
    const sale = baseSale({ status: "scheduled", coverImages: ["old.jpg"] });
    const updated = { ...sale, coverImages: [] };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn().mockResolvedValue(updated),
    } as unknown as ISaleRepository;
    const enqueueRemovedMany = vi.fn().mockResolvedValue(undefined);
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
        imageCleanup: { enqueueRemovedMany } as unknown as ImageCleanupService,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { coverImages: [] },
      "catalogue_manager",
    );

    expect(result.isOk()).toBe(true);
    expect(saleRepo.update).toHaveBeenCalledWith(sale.id, { coverImages: [] });
    expect(enqueueRemovedMany).toHaveBeenCalledWith(["old.jpg"], []);
  });

  it("on scheduled sale persists allowed catalogue fields from patch", async () => {
    const sale = baseSale({ status: "scheduled", title: "Original", coverImages: ["old.jpg"] });
    const updated = { ...sale, coverImages: ["new.jpg"], title: "Renamed" };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn().mockResolvedValue(updated),
    } as unknown as ISaleRepository;
    const enqueueRemovedMany = vi.fn().mockResolvedValue(undefined);
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
        imageCleanup: { enqueueRemovedMany } as unknown as ImageCleanupService,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { coverImages: ["new.jpg"], title: "Renamed" },
      "catalogue_manager",
    );

    expect(result.isOk()).toBe(true);
    expect(saleRepo.update).toHaveBeenCalledWith(sale.id, {
      coverImages: ["new.jpg"],
      title: "Renamed",
    });
  });

  it("allows title-only patch on scheduled sale", async () => {
    const sale = baseSale({ status: "scheduled", title: "Original" });
    const updated = { ...sale, title: "Renamed" };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn().mockResolvedValue(updated),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { title: "Renamed" },
      "catalogue_manager",
    );

    expect(result.isOk()).toBe(true);
    expect(saleRepo.update).toHaveBeenCalledWith(sale.id, { title: "Renamed" });
  });

  it("rejects scheduled sale patch with only disallowed fields", async () => {
    const sale = baseSale({ status: "scheduled" });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn(),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { startTime: new Date("2030-01-02T12:00:00Z") },
      "catalogue_manager",
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.message).toBe("Only draft sales can be edited");
    expect(saleRepo.update).not.toHaveBeenCalled();
  });

  it("allows streamUrl patch on scheduled hybrid sale", async () => {
    const sale = baseSale({
      status: "scheduled",
      deliveryMode: "hybrid",
      streamUrl: null,
    });
    const streamUrl = "https://vimeo.com/event/6005027/embed/53b2f6d9ec";
    const updated = { ...sale, streamUrl };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn().mockResolvedValue(updated),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft("staff", sale.id, { streamUrl }, "catalogue_manager");

    expect(result.isOk()).toBe(true);
    expect(saleRepo.update).toHaveBeenCalledWith(sale.id, { streamUrl });
  });

  it("allows clearing streamUrl on active onsite sale", async () => {
    const sale = baseSale({
      status: "active",
      deliveryMode: "onsite",
      streamUrl: "https://vimeo.com/123",
    });
    const updated = { ...sale, streamUrl: null };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn().mockResolvedValue(updated),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { streamUrl: null },
      "catalogue_manager",
    );

    expect(result.isOk()).toBe(true);
    expect(saleRepo.update).toHaveBeenCalledWith(sale.id, { streamUrl: null });
  });

  it("ignores streamUrl patch on ended sale", async () => {
    const sale = baseSale({
      status: "ended",
      deliveryMode: "hybrid",
      streamUrl: "https://vimeo.com/123",
    });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn(),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { streamUrl: "https://vimeo.com/event/1/embed/x" },
      "catalogue_manager",
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.message).toBe("Only draft sales can be edited");
    expect(saleRepo.update).not.toHaveBeenCalled();
  });

  it("ignores streamUrl patch on online sale", async () => {
    const sale = baseSale({
      status: "active",
      deliveryMode: "online",
      streamUrl: null,
    });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn(),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { streamUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
      "catalogue_manager",
    );

    expect(result.isErr()).toBe(true);
    expect(saleRepo.update).not.toHaveBeenCalled();
  });

  it("rejects catalogue.write staff without auction.manage when patch is not image-only", async () => {
    const sale = baseSale({ status: "draft" });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn(),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft("staff", sale.id, { title: "Renamed" }, "staff_viewer");

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error).toBeInstanceOf(AuthzError);
  });

  it("aggregates lot timing violations when shrinking an online sale window", async () => {
    const saleStart = new Date("2030-06-01T10:00:00Z");
    const saleEnd = new Date("2030-06-07T18:00:00Z");
    const sale = baseSale({
      status: "draft",
      deliveryMode: "online",
      allowOnlineBidsBeforeGoLive: false,
      startTime: saleStart,
      endTime: saleEnd,
    });
    const lots: Lot[] = [
      {
        id: "lot-1",
        saleId: sale.id,
        lotNumber: 1,
        sellerLegalEntityId: "seller-1",
        artistId: null,
        title: "Blue vase",
        description: null,
        medium: null,
        dimensions: null,
        images: [],
        categoryId: "c1",
        auctionType: "english",
        startingPrice: "100",
        reservePrice: null,
        buyNowPrice: null,
        currentPrice: "100",
        buyerPremiumRate: "0.25",
        minBidIncrement: "10",
        dutchDecrementAmount: null,
        dutchDecrementIntervalMs: 60_000,
        dutchLastDecrementAt: null,
        startTime: new Date("2030-06-01T10:00:00Z"),
        endTime: new Date("2030-06-08T18:00:00Z"),
        status: "draft",
        winnerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        marketingDetails: {},
      },
      {
        id: "lot-2",
        saleId: sale.id,
        lotNumber: 2,
        sellerLegalEntityId: "seller-1",
        artistId: null,
        title: "Red vase",
        description: null,
        medium: null,
        dimensions: null,
        images: [],
        categoryId: "c1",
        auctionType: "english",
        startingPrice: "100",
        reservePrice: null,
        buyNowPrice: null,
        currentPrice: "100",
        buyerPremiumRate: "0.25",
        minBidIncrement: "10",
        dutchDecrementAmount: null,
        dutchDecrementIntervalMs: 60_000,
        dutchLastDecrementAt: null,
        startTime: new Date("2030-06-01T10:00:00Z"),
        endTime: new Date("2030-06-09T18:00:00Z"),
        status: "draft",
        winnerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        marketingDetails: {},
      },
    ];
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn(),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue(lots),
    } as unknown as ILotRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { endTime: new Date("2030-06-06T18:00:00Z") },
      "super_admin",
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.message).toContain("Blue vase");
    expect(result.error.message).toContain("Red vase");
    expect(result.error.message).toContain(";");
    expect(saleRepo.update).not.toHaveBeenCalled();
  });

  it("syncs draft lots when an onsite draft sale schedule changes", async () => {
    const oldStart = new Date("2030-06-01T10:00:00Z");
    const oldEnd = new Date("2030-06-07T18:00:00Z");
    const newStart = new Date("2030-06-02T10:00:00Z");
    const newEnd = new Date("2030-06-08T18:00:00Z");
    const sale = baseSale({
      status: "draft",
      deliveryMode: "onsite",
      startTime: oldStart,
      endTime: oldEnd,
    });
    const lot: Lot = {
      id: "lot-1",
      saleId: sale.id,
      lotNumber: 1,
      sellerLegalEntityId: "seller-1",
      artistId: null,
      title: "Blue vase",
      description: null,
      medium: null,
      dimensions: null,
      images: [],
      categoryId: "c1",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: oldStart,
      endTime: oldEnd,
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };
    const lotUpdate = vi.fn().mockResolvedValue({ ...lot, startTime: newStart, endTime: newEnd });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn().mockResolvedValue({ ...sale, startTime: newStart, endTime: newEnd }),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([lot]),
      update: lotUpdate,
    } as unknown as ILotRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { startTime: newStart, endTime: newEnd },
      "super_admin",
    );

    expect(result.isOk()).toBe(true);
    expect(lotUpdate).toHaveBeenCalledWith("lot-1", {
      startTime: newStart,
      endTime: newEnd,
    });
    expect(saleRepo.update).toHaveBeenCalled();
  });
});

describe("SaleService.publish authorization", () => {
  it("returns 403 when catalogue_manager staff tries to publish a sale", async () => {
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo: {} as ISaleRepository,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
      }),
    );
    const result = await svc.publish(TEST_ADMIN_USER_ID, "staff", "s1", "catalogue_manager");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AuthzError);
      expect((result.error as AuthzError).status).toBe(403);
    }
  });
});

describe("SaleService.publish domain events", () => {
  it("emits sale.published when a draft sale is published", async () => {
    const sale = baseSale({ id: "s-pub", status: "draft", deliveryMode: "online" });
    const lot: Lot = {
      id: "lot-1",
      saleId: "s-pub",
      lotNumber: 1,
      sellerLegalEntityId: "seller-1",
      artistId: null,
      title: "Work",
      description: "Catalogue description",
      medium: null,
      dimensions: null,
      images: ["img.jpg"],
      categoryId: "c1",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 172_800_000),
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };

    let findCalls = 0;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockImplementation(async () => {
        findCalls += 1;
        return findCalls === 1 ? sale : { ...sale, status: "scheduled" };
      }),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISaleRepository;

    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([lot]),
      update: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;

    const publish = vi.fn().mockResolvedValue(undefined);
    const domainEventSink = {
      publish,
      withTx: vi.fn().mockReturnValue({ publish }),
    } as unknown as IDomainEventSink;
    const db = {
      transaction: vi.fn(async (fn: (tx: Database) => Promise<unknown>) => fn({} as Database)),
    } as unknown as Database;
    const transactionRunner = transactionRunnerFromDb(db);

    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: {
          scheduleLot: vi.fn(),
          cancelLotJobs: vi.fn(),
          cancelLotEndJob: vi.fn(),
          rescheduleEnd: vi.fn(),
        } as ILotJobScheduler,
        transactionRunner,
        domainEventSink,
      }),
    );

    const result = await svc.publish(TEST_ADMIN_USER_ID, "staff", "s-pub", "super_admin");
    if (result.isErr()) {
      throw new Error(`publish failed: ${result.error.message}`);
    }
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "sale",
        aggregateId: "s-pub",
        eventType: "sale.published",
        actorUserId: TEST_ADMIN_USER_ID,
        payload: expect.objectContaining({
          from_status: "draft",
          to_status: "scheduled",
        }),
      }),
    );
  });

  it("blocks publish when seller connect is not ready", async () => {
    const sale = baseSale({ id: "s-connect", status: "draft", deliveryMode: "online" });
    const lot: Lot = {
      id: "lot-1",
      saleId: "s-connect",
      lotNumber: 1,
      sellerLegalEntityId: "seller-1",
      artistId: null,
      title: "Work",
      description: "Catalogue description",
      medium: null,
      dimensions: null,
      images: ["img.jpg"],
      categoryId: "c1",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 172_800_000),
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };

    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      updateStatus: vi.fn(),
    } as unknown as ISaleRepository;

    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([lot]),
    } as unknown as ILotRepository;

    const legalEntityRepository = {
      findById: vi.fn().mockResolvedValue({
        status: "approved",
        stripeConnectPayoutsEnabled: false,
        stripeConnectRequirementsCurrentlyDue: [],
      }),
    } as unknown as ILegalEntityRepository;

    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
        legalEntityRepository,
        enforceIndividualConnectOnPublish: true,
      }),
    );

    const result = await svc.publish(TEST_ADMIN_USER_ID, "staff", "s-connect", "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LotError);
      expect(result.error.code).toBe("connect_required");
    }
  });

  it("reverts sale and lots to draft when scheduleLot fails mid-loop", async () => {
    const sale = baseSale({ id: "s-sched-fail", status: "draft", deliveryMode: "online" });
    const lot1: Lot = {
      id: "lot-1",
      saleId: "s-sched-fail",
      lotNumber: 1,
      sellerLegalEntityId: "seller-1",
      artistId: null,
      title: "Work 1",
      description: "Catalogue description",
      medium: null,
      dimensions: null,
      images: ["img.jpg"],
      categoryId: "c1",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 172_800_000),
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };
    const lot2: Lot = { ...lot1, id: "lot-2", lotNumber: 2, title: "Work 2" };

    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISaleRepository;

    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([lot1, lot2]),
      update: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ILotRepository;

    const scheduleLot = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("redis down"));
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);

    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: {
          scheduleLot,
          cancelLotJobs,
          rescheduleEnd: vi.fn(),
          cancelLotEndJob: vi.fn(),
        } as ILotJobScheduler,
      }),
    );

    const result = await svc.publish(TEST_ADMIN_USER_ID, "staff", "s-sched-fail", "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        name: "LotError",
        code: "schedule_jobs_failed",
        status: 503,
      });
    }
    expect(saleRepo.updateStatus).toHaveBeenCalledWith("s-sched-fail", "scheduled");
    expect(saleRepo.updateStatus).toHaveBeenCalledWith("s-sched-fail", "draft");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith("lot-1", "scheduled");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith("lot-2", "scheduled");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith("lot-1", "draft");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith("lot-2", "draft");
    expect(cancelLotJobs).toHaveBeenCalledWith("lot-1");
    expect(scheduleLot).toHaveBeenCalledTimes(2);
  });
});

describe("SaleService.addLot emergency add", () => {
  const categoryId = "00000000-0000-4000-8000-0000000000c0";
  const saleStart = new Date(Date.now() + 86_400_000);
  const saleEnd = new Date(Date.now() + 86_400_000 * 8);
  const lotStart = new Date(Date.now() + 86_400_000 * 2);
  const lotEnd = new Date(Date.now() + 86_400_000 * 3);

  const activeSale = baseSale({
    id: "sale-live",
    status: "active",
    deliveryMode: "online",
    startTime: saleStart,
    endTime: saleEnd,
  });

  const existingLot: Lot = {
    id: "lot-existing",
    saleId: "sale-live",
    lotNumber: 5,
    sellerLegalEntityId: "seller-1",
    artistId: null,
    title: "Existing",
    description: "Desc",
    medium: null,
    dimensions: null,
    images: ["img.jpg"],
    categoryId,
    auctionType: "english",
    startingPrice: "10",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "10",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: lotStart,
    endTime: lotEnd,
    status: "scheduled",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
  };

  it("auto-assigns lot number and publishes on active sale", async () => {
    const createdDraft: Lot = {
      ...existingLot,
      id: "lot-new",
      lotNumber: 6,
      status: "draft",
    };
    const scheduledLot: Lot = { ...createdDraft, status: "scheduled" };
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([existingLot]),
      create: vi.fn().mockResolvedValue(createdDraft),
      update: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(scheduledLot),
      clearSaleId: vi.fn(),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(activeSale),
    } as unknown as ISaleRepository;
    const scheduleLot = vi.fn().mockResolvedValue(undefined);
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: {
          scheduleLot,
          cancelLotJobs: vi.fn(),
          rescheduleEnd: vi.fn(),
          cancelLotEndJob: vi.fn(),
        } as ILotJobScheduler,
      }),
    );

    const result = await svc.addLot(
      "staff",
      "sale-live",
      {
        title: "Emergency lot",
        sellerId: "seller-1",
        categoryIds: [categoryId],
        auctionType: "english",
        startingPrice: "100",
        startTime: lotStart,
        endTime: lotEnd,
        description: "Catalogue description",
        images: ["img.jpg"],
      },
      "super_admin",
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.status).toBe("scheduled");
      expect(result.value.lotNumber).toBe(6);
    }
    expect(lotRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ lotNumber: 6, saleId: "sale-live" }),
    );
    expect(scheduleLot).toHaveBeenCalled();
  });

  it("rolls back and returns meta when publish fails", async () => {
    const createdDraft: Lot = {
      ...existingLot,
      id: "lot-new",
      lotNumber: 6,
      status: "draft",
      images: [],
      description: null,
    };
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([existingLot]),
      create: vi.fn().mockResolvedValue(createdDraft),
      updateStatus: vi.fn(),
      findById: vi.fn().mockResolvedValue(createdDraft),
      clearSaleId: vi.fn().mockResolvedValue(undefined),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(activeSale),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
      }),
    );

    const result = await svc.addLot(
      "staff",
      "sale-live",
      {
        title: "Emergency lot",
        sellerId: "seller-1",
        categoryIds: [categoryId],
        auctionType: "english",
        startingPrice: "100",
        startTime: lotStart,
        endTime: lotEnd,
      },
      "super_admin",
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.code).toBe("emergency_add_publish_failed");
      expect(result.error.meta).toEqual({ lotId: "lot-new", rolledBack: true });
    }
    expect(lotRepo.clearSaleId).toHaveBeenCalledWith("lot-new");
  });
});

describe("SaleService.detachLot", () => {
  it("rejects detaching non-draft lots", async () => {
    const sale = baseSale({ status: "draft" });
    const lot: Lot = {
      id: "lot-1",
      saleId: sale.id,
      lotNumber: 1,
      sellerLegalEntityId: "seller-1",
      artistId: null,
      title: "Work",
      description: "Catalogue description",
      medium: null,
      dimensions: null,
      images: ["img.jpg"],
      categoryId: "c1",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 172_800_000),
      status: "scheduled",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      clearSaleId: vi.fn(),
    } as unknown as ILotRepository;
    const svc = new SaleService(saleServiceOpts({ saleRepo, lotRepo, jobScheduler: null }));

    const result = await svc.detachLot("staff", sale.id, lot.id, "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Only draft lots");
    }
    expect(lotRepo.clearSaleId).not.toHaveBeenCalled();
  });
});

describe("SaleService.getSaleDetailForPublicApi", () => {
  it("returns null when sale missing", async () => {
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ISaleRepository;
    const lotRepo = {} as unknown as ILotRepository;
    const svc = new SaleService(saleServiceOpts({ saleRepo, lotRepo, jobScheduler: null }));
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
      allowOnlineBidsBeforeGoLive: false,
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
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
        saleFollowReader: follow,
      }),
    );
    const r = await svc.getSaleDetailForPublicApi("s1", "user-1");
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.data.viewer.isFollowing).toBe(true);
    expect(follow.isFollowing).toHaveBeenCalledWith("user-1", "s1");
  });

  it("returns null for draft sale when viewer cannot preview", async () => {
    const sale = baseSale({ id: "s-draft", status: "draft" });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([]),
    } as unknown as ILotRepository;
    const svc = new SaleService(saleServiceOpts({ saleRepo, lotRepo, jobScheduler: null }));
    const r = await svc.getSaleDetailForPublicApi("s-draft", undefined);
    expect(r).toBeNull();
  });
});

describe("SaleService.listSaleLotsPageForPublicApi", () => {
  function mkLot(id: string, status: Lot["status"], lotNumber: number): Lot {
    return {
      id,
      saleId: "s1",
      lotNumber,
      sellerId: "seller-1",
      title: `Lot ${lotNumber}`,
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
      dutchDecrementIntervalMs: 0,
      dutchLastDecrementAt: null,
      startTime: new Date("2026-06-01T12:00:00.000Z"),
      endTime: new Date("2026-06-02T12:00:00.000Z"),
      status,
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };
  }

  it("paginates visible lots with correct total for anonymous viewers", async () => {
    const sale = baseSale({ id: "s1", status: "active" });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
    } as unknown as ISaleRepository;
    const listCatalogLotsBySalePage = vi
      .fn()
      .mockResolvedValueOnce({
        items: [mkLot("l1", "scheduled", 1), mkLot("l3", "active", 3)],
        total: 3,
      })
      .mockResolvedValueOnce({
        items: [mkLot("l5", "scheduled", 5)],
        total: 3,
      });
    const lotRepo: ILotRepository = {
      listCatalogLotsBySalePage,
    } as unknown as ILotRepository;
    const svc = new SaleService(saleServiceOpts({ saleRepo, lotRepo, jobScheduler: null }));

    const page1 = await svc.listSaleLotsPageForPublicApi(
      "s1",
      { limit: 2, offset: 0, sort: "lot" },
      undefined,
    );
    expect(page1?.data.total).toBe(3);
    expect(page1?.data.items.map((l) => l.id)).toEqual(["l1", "l3"]);
    expect(listCatalogLotsBySalePage).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: "s1",
        requirePublicSale: true,
        lotStatuses: ["scheduled", "active", "ended"],
      }),
    );

    const page2 = await svc.listSaleLotsPageForPublicApi(
      "s1",
      { limit: 2, offset: 2, sort: "lot" },
      undefined,
    );
    expect(page2?.data.total).toBe(3);
    expect(page2?.data.items.map((l) => l.id)).toEqual(["l5"]);
  });

  it("loads all lots for staff preview without public filters", async () => {
    const sale = baseSale({ id: "s1", status: "draft" });
    const listCatalogLotsBySalePage = vi.fn().mockResolvedValue({
      items: [mkLot("l1", "draft", 1)],
      total: 1,
    });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      listCatalogLotsBySalePage,
    } as unknown as ILotRepository;
    const svc = new SaleService(saleServiceOpts({ saleRepo, lotRepo, jobScheduler: null }));

    await svc.listSaleLotsPageForPublicApi(
      "s1",
      { limit: 10, offset: 0, sort: "lot" },
      { role: "staff", staffRole: "catalogue_manager" },
    );
    expect(listCatalogLotsBySalePage).toHaveBeenCalledWith({
      saleId: "s1",
      sort: "lot",
      limit: 10,
      offset: 0,
    });
  });
});

function testVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "venue-1",
    legalEntityId: TEST_PLATFORM_CATALOG_LEGAL_ENTITY_ID,
    name: "LAX Mayfair Saleroom",
    slug: "lax-mayfair-saleroom",
    addressLine1: "12 King Street",
    addressLine2: "St James's",
    city: "London",
    county: null,
    postcode: "SW1Y 6QU",
    country: "United Kingdom",
    mapUrl: "https://maps.example.com",
    latitude: null,
    longitude: null,
    openingHours: null,
    contactPhone: null,
    contactEmail: null,
    website: null,
    photos: [],
    capacity: null,
    accessNotes: null,
    parkingNotes: null,
    directionsNotes: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SaleService venue assignment", () => {
  it("rejects a venue from another organisation on create", async () => {
    const venueRepo: IVenueRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(testVenue({ id: "venue-other", legalEntityId: "other-org-id" })),
    } as unknown as IVenueRepository;
    const saleRepo: ISaleRepository = {
      create: vi.fn(),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
        venueRepository: venueRepo,
      }),
    );

    await expect(
      svc.create(TEST_ADMIN_USER_ID, {
        title: "Evening",
        startTime: new Date(Date.now() + 86_400_000),
        endTime: new Date(Date.now() + 172_800_000),
        streamUrl: null,
        locationName: "Custom Hall",
        locationAddress: null,
        locationMapUrl: null,
        locationAddressLine1: null,
        locationAddressLine2: null,
        locationCity: null,
        locationCounty: null,
        locationPostcode: null,
        locationCountry: null,
        venueId: "venue-other",
      }),
    ).rejects.toMatchObject({ code: "venue_org_mismatch" });
    expect(saleRepo.create).not.toHaveBeenCalled();
  });

  it("preserves draft location fields on create when a venue is selected", async () => {
    const venueRepo: IVenueRepository = {
      findById: vi.fn().mockResolvedValue(testVenue()),
    } as unknown as IVenueRepository;
    const createdSale = baseSale({
      id: "s-new",
      status: "draft",
      venueId: "venue-1",
      locationName: "Custom Hall",
      createdByLegalEntityId: TEST_PLATFORM_CATALOG_LEGAL_ENTITY_ID,
    });
    const saleRepo: ISaleRepository = {
      create: vi.fn().mockResolvedValue(createdSale),
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
        venueRepository: venueRepo,
      }),
    );

    await svc.create(TEST_ADMIN_USER_ID, {
      title: "Evening",
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 172_800_000),
      streamUrl: null,
      locationName: "Custom Hall",
      locationAddress: null,
      locationMapUrl: null,
      locationAddressLine1: null,
      locationAddressLine2: null,
      locationCity: null,
      locationCounty: null,
      locationPostcode: null,
      locationCountry: null,
      venueId: "venue-1",
    });

    expect(saleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        venueId: "venue-1",
        locationName: "Custom Hall",
      }),
    );
  });

  it("does not overwrite draft location fields on updateDraft when venueId is set", async () => {
    const venueRepo: IVenueRepository = {
      findById: vi.fn().mockResolvedValue(testVenue()),
    } as unknown as IVenueRepository;
    const sale = baseSale({
      status: "draft",
      venueId: "venue-1",
      locationName: "Custom Hall",
      createdByLegalEntityId: TEST_PLATFORM_CATALOG_LEGAL_ENTITY_ID,
    });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      update: vi.fn().mockResolvedValue(sale),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([]),
    } as unknown as ILotRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
        venueRepository: venueRepo,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      sale.id,
      { locationName: "Renamed Hall", venueId: "venue-1" },
      "super_admin",
    );

    expect(result.isOk()).toBe(true);
    expect(saleRepo.update).toHaveBeenCalledWith(
      sale.id,
      expect.objectContaining({
        venueId: "venue-1",
        locationName: "Renamed Hall",
      }),
    );
  });

  it("snapshots venue address onto the sale at publish", async () => {
    const venueRepo: IVenueRepository = {
      findById: vi.fn().mockResolvedValue(testVenue()),
    } as unknown as IVenueRepository;
    const sale = baseSale({
      id: "s-pub",
      status: "draft",
      venueId: "venue-1",
      locationName: "Custom Hall",
      createdByLegalEntityId: TEST_PLATFORM_CATALOG_LEGAL_ENTITY_ID,
    });
    const lot: Lot = {
      id: "lot-1",
      saleId: "s-pub",
      lotNumber: 1,
      sellerLegalEntityId: "seller-1",
      artistId: null,
      title: "Work",
      description: "Catalogue description",
      medium: null,
      dimensions: null,
      images: ["img.jpg"],
      categoryId: "c1",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 172_800_000),
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };

    let findCalls = 0;
    const update = vi.fn().mockResolvedValue({
      ...sale,
      locationName: "LAX Mayfair Saleroom",
      locationAddressLine1: "12 King Street",
    });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockImplementation(async () => {
        findCalls += 1;
        return findCalls === 1 ? sale : { ...sale, status: "scheduled" };
      }),
      update,
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([lot]),
      update: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;

    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: {
          scheduleLot: vi.fn(),
          cancelLotJobs: vi.fn(),
          cancelLotEndJob: vi.fn(),
          rescheduleEnd: vi.fn(),
        } as ILotJobScheduler,
        venueRepository: venueRepo,
      }),
    );

    const result = await svc.publish(TEST_ADMIN_USER_ID, "staff", "s-pub", "super_admin");
    if (result.isErr()) {
      throw new Error(`publish failed: ${result.error.message}`);
    }

    expect(update).toHaveBeenCalledWith(
      "s-pub",
      expect.objectContaining({
        venueId: "venue-1",
        locationName: "LAX Mayfair Saleroom",
        locationAddressLine1: "12 King Street",
        locationPostcode: "SW1Y 6QU",
      }),
    );
  });

  it("blocks publish for onsite sales without venue or location", async () => {
    const sale = baseSale({
      id: "s-empty",
      status: "draft",
      deliveryMode: "onsite",
      allowOnlineBidsBeforeGoLive: false,
      locationName: null,
      locationAddress: null,
      locationAddressLine1: null,
      createdByLegalEntityId: TEST_PLATFORM_CATALOG_LEGAL_ENTITY_ID,
    });
    const lot: Lot = {
      id: "lot-1",
      saleId: "s-empty",
      lotNumber: 1,
      sellerLegalEntityId: "seller-1",
      artistId: null,
      title: "Work",
      description: "Catalogue description",
      medium: null,
      dimensions: null,
      images: ["img.jpg"],
      categoryId: "c1",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: "100",
      buyerPremiumRate: "0.25",
      minBidIncrement: "10",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 172_800_000),
      status: "draft",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingDetails: {},
    };
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(sale),
      updateStatus: vi.fn(),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findBySaleId: vi.fn().mockResolvedValue([lot]),
    } as unknown as ILotRepository;
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo,
        jobScheduler: null,
      }),
    );

    const result = await svc.publish(TEST_ADMIN_USER_ID, "staff", "s-empty", "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("onsite_location_required");
    }
    expect(saleRepo.updateStatus).not.toHaveBeenCalled();
  });
});

describe("SaleService.updateDraft — auction-day photos", () => {
  function makeEndedOnsiteSale(overrides: Partial<Sale> = {}): Sale {
    return baseSale({
      status: "ended",
      deliveryMode: "onsite",
      ...overrides,
    });
  }

  it("accepts dayImages for ended onsite sale", async () => {
    const endedSale = makeEndedOnsiteSale();
    const update = vi.fn().mockResolvedValue({ ...endedSale });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(endedSale),
      update,
    } as unknown as ISaleRepository;
    const enqueueRemovedMany = vi.fn().mockResolvedValue(undefined);
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
        imageCleanup: { enqueueRemovedMany } as unknown as ImageCleanupService,
      }),
    );

    const result = await svc.updateDraft(
      "staff",
      endedSale.id,
      { dayImages: [{ key: "day-photo-1.jpg", caption: "Lot 1 on the block" }] },
      "super_admin",
    );
    expect(result.isErr()).toBe(false);
    expect(update).toHaveBeenCalledWith(
      endedSale.id,
      expect.objectContaining({
        dayImages: [{ key: "day-photo-1.jpg", caption: "Lot 1 on the block" }],
      }),
    );
  });

  it("accepts dayImages for ended hybrid sale", async () => {
    const endedHybrid = makeEndedOnsiteSale({ deliveryMode: "hybrid" });
    const update = vi.fn().mockResolvedValue({ ...endedHybrid });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(endedHybrid),
      update,
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({ saleRepo, lotRepo: {} as ILotRepository, jobScheduler: null }),
    );

    const result = await svc.updateDraft(
      "staff",
      endedHybrid.id,
      { dayImages: [{ key: "day-2.jpg" }] },
      "super_admin",
    );
    expect(result.isErr()).toBe(false);
    expect(update).toHaveBeenCalledWith(
      endedHybrid.id,
      expect.objectContaining({ dayImages: [{ key: "day-2.jpg" }] }),
    );
  });

  it("rejects dayImages for online sale (no location capability)", async () => {
    const endedOnline = makeEndedOnsiteSale({ deliveryMode: "online" });
    const update = vi.fn().mockResolvedValue({ ...endedOnline });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(endedOnline),
      update,
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({ saleRepo, lotRepo: {} as ILotRepository, jobScheduler: null }),
    );

    const result = await svc.updateDraft(
      "staff",
      endedOnline.id,
      { dayImages: [{ key: "day-3.jpg" }] },
      "super_admin",
    );
    expect(result.isErr()).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects dayImages for non-ended onsite sale", async () => {
    const scheduledSale = baseSale({ deliveryMode: "onsite", status: "scheduled" });
    const update = vi.fn().mockResolvedValue({ ...scheduledSale });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(scheduledSale),
      update,
    } as unknown as ISaleRepository;
    const svc = new SaleService(
      saleServiceOpts({ saleRepo, lotRepo: {} as ILotRepository, jobScheduler: null }),
    );

    const result = await svc.updateDraft(
      "staff",
      scheduledSale.id,
      { dayImages: [{ key: "day-4.jpg" }] },
      "super_admin",
    );
    expect(result.isErr()).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("enqueues cleanup for removed day-photo keys", async () => {
    const endedSale = makeEndedOnsiteSale({
      dayImages: [{ key: "old-key.jpg" }, { key: "keep-key.jpg" }],
    });
    const update = vi.fn().mockResolvedValue({ ...endedSale });
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(endedSale),
      update,
    } as unknown as ISaleRepository;
    const enqueueRemovedMany = vi.fn().mockResolvedValue(undefined);
    const svc = new SaleService(
      saleServiceOpts({
        saleRepo,
        lotRepo: {} as ILotRepository,
        jobScheduler: null,
        imageCleanup: { enqueueRemovedMany } as unknown as ImageCleanupService,
      }),
    );

    await svc.updateDraft(
      "staff",
      endedSale.id,
      { dayImages: [{ key: "keep-key.jpg" }] },
      "super_admin",
    );
    expect(enqueueRemovedMany).toHaveBeenCalledWith(
      ["old-key.jpg", "keep-key.jpg"],
      ["keep-key.jpg"],
    );
  });
});
