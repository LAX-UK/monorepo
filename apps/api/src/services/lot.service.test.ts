import type { Bid, CreateLotInput, LegalEntity, Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import { lotBidderRef } from "../lib/lot-bidder-ref.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotNotificationCoordinator } from "./interfaces/lot-notifications.js";
import type { IBidRepository, ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import { LotService } from "./lot.service.js";

const lotId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-0000000000c0";
const saleAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const saleBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function mkSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: saleBId,
    title: "Target sale",
    description: null,
    coverImages: [],
    categoryId,
    deliveryMode: "online",
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
    startTime: new Date("2026-06-01T10:00:00Z"),
    endTime: new Date("2026-06-07T18:00:00Z"),
    previewStartTime: null,
    status: "draft",
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const baseLot: Lot = {
  id: lotId,
  saleId: null,
  lotNumber: 1,
  sellerId: "s1",
  title: "T",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
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
  startTime: new Date(),
  endTime: new Date(),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: { artistNote: "x" },
};

function mkIndividualEntity(overrides: Partial<LegalEntity> = {}): LegalEntity {
  return {
    id: "ent-1",
    displayName: "Alice",
    legalName: null,
    slug: null,
    kind: "individual",
    subkind: "private_collector",
    createdByUserId: "u1",
    status: "approved",
    statusChangedAt: null,
    statusChangedByUserId: null,
    stripeConnectAccountId: "acct_1",
    stripeCustomerId: null,
    stripeConnectChargesEnabled: true,
    stripeConnectPayoutsEnabled: true,
    stripeConnectRequirementsCurrentlyDue: [],
    stripeConnectDisabledReason: null,
    xeroContactId: null,
    vatNumber: null,
    marginSchemeEligible: false,
    isLaxManaged: false,
    platformFeeBps: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createSut(overrides: { lot?: Partial<Lot> } = {}) {
  const lot: Lot = { ...baseLot, ...overrides.lot };
  const findById = vi.fn().mockResolvedValue(lot);
  const updateMarketingDetails = vi.fn().mockImplementation(async () => ({
    ...lot,
    marketingDetails: { ...lot.marketingDetails, artistNote: "y" },
  }));
  const lotRepo: ILotRepository = {
    findById,
    updateMarketingDetails,
  } as unknown as ILotRepository;
  const bids = {} as unknown as IBidRepository;
  const watchlist = {} as unknown as IWatchlistRepository;
  const svc = new LotService({
    lotRepo,
    bids,
    watchlist,
    jobScheduler: null,
    lotNotifications: null,
  });
  return { svc, findById, updateMarketingDetails };
}

describe("LotService.update", () => {
  it("allows images-only patch on active lot for catalogue.write staff", async () => {
    const lot: Lot = { ...baseLot, status: "active", images: ["old.jpg"] };
    const updated: Lot = { ...lot, images: ["new.jpg"] };
    const update = vi.fn().mockResolvedValue(updated);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      update,
    } as unknown as ILotRepository;
    const enqueueRemovedMany = vi.fn().mockResolvedValue(undefined);
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
      imageCleanup: { enqueueRemovedMany } as unknown as ImageCleanupService,
    });

    const result = await svc.update("staff", lotId, { images: ["new.jpg"] }, "catalogue_manager");

    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith(lotId, { images: ["new.jpg"] });
    expect(enqueueRemovedMany).toHaveBeenCalledWith(["old.jpg"], ["new.jpg"]);
  });

  it("clears images with empty array on active lot", async () => {
    const lot: Lot = { ...baseLot, status: "active", images: ["old.jpg"] };
    const updated: Lot = { ...lot, images: [] };
    const update = vi.fn().mockResolvedValue(updated);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      update,
    } as unknown as ILotRepository;
    const enqueueRemovedMany = vi.fn().mockResolvedValue(undefined);
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
      imageCleanup: { enqueueRemovedMany } as unknown as ImageCleanupService,
    });

    const result = await svc.update("staff", lotId, { images: [] }, "catalogue_manager");

    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith(lotId, { images: [] });
    expect(enqueueRemovedMany).toHaveBeenCalledWith(["old.jpg"], []);
  });

  it("on active lot only persists images when full form patch is sent", async () => {
    const lot: Lot = { ...baseLot, status: "active", images: ["old.jpg"] };
    const updated: Lot = { ...lot, images: ["new.jpg"] };
    const update = vi.fn().mockResolvedValue(updated);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      update,
    } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });

    const result = await svc.update(
      "staff",
      lotId,
      { images: ["new.jpg"], title: "Renamed" },
      "catalogue_manager",
    );

    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith(lotId, { images: ["new.jpg"] });
  });

  it("allows full patch on scheduled lot and reschedules lifecycle jobs when times change", async () => {
    const startTime = new Date(Date.now() + 86_400_000);
    const endTime = new Date(Date.now() + 172_800_000);
    const lot: Lot = { ...baseLot, status: "scheduled", startTime, endTime };
    const nextStart = new Date(Date.now() + 100_800_000);
    const nextEnd = new Date(Date.now() + 259_200_000);
    const updated: Lot = { ...lot, title: "Renamed", startTime: nextStart, endTime: nextEnd };
    const update = vi.fn().mockResolvedValue(updated);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      update,
    } as unknown as ILotRepository;
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const scheduleLot = vi.fn().mockResolvedValue(undefined);
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        cancelLotJobs,
        scheduleLot,
        rescheduleEnd: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
    });

    const result = await svc.update(
      "staff",
      lotId,
      { title: "Renamed", startTime: nextStart, endTime: nextEnd },
      "catalogue_manager",
    );

    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith(lotId, {
      title: "Renamed",
      startTime: nextStart,
      endTime: nextEnd,
    });
    expect(cancelLotJobs).toHaveBeenCalledWith(lotId);
    expect(scheduleLot).toHaveBeenCalledWith(lotId, nextStart, nextEnd);
  });

  it("rejects non-image patch on active lot", async () => {
    const lot: Lot = { ...baseLot, status: "active", images: ["old.jpg"] };
    const update = vi.fn();
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      update,
    } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });

    const result = await svc.update("staff", lotId, { title: "Renamed" }, "catalogue_manager");

    expect(result.isErr()).toBe(true);
    if (result.isErr())
      expect(result.error.message).toBe("Only images can be edited on an active lot");
    expect(update).not.toHaveBeenCalled();
  });

  it("reassigns draft lot to a new draft sale with auto lot number", async () => {
    const saleStart = new Date(Date.now() + 43_200_000);
    const saleEnd = new Date(Date.now() + 604_800_000);
    const startTime = new Date(Date.now() + 86_400_000);
    const endTime = new Date(Date.now() + 172_800_000);
    const lot: Lot = {
      ...baseLot,
      status: "draft",
      saleId: saleAId,
      lotNumber: 1,
      startTime,
      endTime,
    };
    const updated: Lot = { ...lot, saleId: saleBId, lotNumber: 3 };
    const update = vi.fn().mockResolvedValue(updated);
    const findBySaleId = vi.fn().mockImplementation(async (saleId: string) =>
      saleId === saleBId
        ? [
            { ...lot, id: "other-1", lotNumber: 1 },
            { ...lot, id: "other-2", lotNumber: 2 },
          ]
        : [],
    );
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      findBySaleId,
      update,
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockImplementation(async (id: string) =>
        mkSale({
          id,
          status: "draft",
          deliveryMode: "online",
          allowOnlineBidsBeforeGoLive: false,
          startTime: saleStart,
          endTime: saleEnd,
        }),
      ),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });

    const result = await svc.update("staff", lotId, { saleId: saleBId }, "catalogue_manager");

    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith(lotId, {
      saleId: saleBId,
      lotNumber: 3,
      startTime,
      endTime,
    });
  });

  it("rejects reassigning scheduled lot to another sale", async () => {
    const lot: Lot = {
      ...baseLot,
      status: "scheduled",
      saleId: saleAId,
      lotNumber: 1,
    };
    const update = vi.fn();
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      findBySaleId: vi.fn(),
      update,
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(mkSale({ id: saleBId, status: "draft" })),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });

    const result = await svc.update("staff", lotId, { saleId: saleBId }, "catalogue_manager");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Only draft lots can be moved between sales");
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 400 when reassigning to a sale with a conflicting lot number", async () => {
    const lot: Lot = {
      ...baseLot,
      status: "draft",
      saleId: saleAId,
      lotNumber: 1,
    };
    const update = vi.fn();
    const findBySaleId = vi.fn().mockResolvedValue([{ ...lot, id: "other-1", lotNumber: 5 }]);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      findBySaleId,
      update,
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(mkSale({ id: saleBId })),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });

    const result = await svc.update(
      "staff",
      lotId,
      { saleId: saleBId, lotNumber: 5 },
      "catalogue_manager",
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LotError);
      expect(result.error.status).toBe(400);
      expect(result.error.message).toContain("Lot number already used");
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("inherits onsite sale timing when reassigning draft lot to that sale", async () => {
    const saleStart = new Date("2026-07-01T10:00:00Z");
    const saleEnd = new Date("2026-07-07T18:00:00Z");
    const lot: Lot = {
      ...baseLot,
      status: "draft",
      saleId: saleAId,
      lotNumber: 1,
      startTime: new Date(Date.now() + 86_400_000),
      endTime: new Date(Date.now() + 172_800_000),
    };
    const update = vi.fn().mockImplementation(async (_id, patch) => ({
      ...lot,
      ...patch,
    }));
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      findBySaleId: vi.fn().mockResolvedValue([]),
      update,
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockImplementation(async (id: string) =>
        mkSale({
          id,
          status: "draft",
          deliveryMode: "onsite",
          allowOnlineBidsBeforeGoLive: false,
          startTime: saleStart,
          endTime: saleEnd,
        }),
      ),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });

    const result = await svc.update("staff", lotId, { saleId: saleBId }, "catalogue_manager");

    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith(lotId, {
      saleId: saleBId,
      lotNumber: 1,
      startTime: saleStart,
      endTime: saleEnd,
    });
  });

  it("maps lot number unique violations from the database to a 400 LotError", async () => {
    const lot: Lot = {
      ...baseLot,
      status: "draft",
      saleId: saleAId,
      lotNumber: 1,
      startTime: new Date("2026-06-02T10:00:00Z"),
      endTime: new Date("2026-06-03T18:00:00Z"),
    };
    const pgError = Object.assign(
      new Error('duplicate key value violates unique constraint "lot_sale_id_lot_number_uid"'),
      {
        code: "23505",
      },
    );
    const update = vi.fn().mockRejectedValue(pgError);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      findBySaleId: vi.fn().mockResolvedValue([]),
      update,
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(mkSale({ id: saleBId })),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });

    const result = await svc.update("staff", lotId, { saleId: saleBId }, "catalogue_manager");

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(400);
      expect(result.error.message).toContain("Lot number already used");
    }
  });

  it("rejects online lot times outside the assigned sale window", async () => {
    const saleStart = new Date("2026-06-01T10:00:00Z");
    const saleEnd = new Date("2026-06-07T18:00:00Z");
    const lot: Lot = {
      ...baseLot,
      status: "draft",
      saleId: saleAId,
      lotNumber: 1,
      startTime: new Date("2026-06-02T10:00:00Z"),
      endTime: new Date("2026-06-03T18:00:00Z"),
    };
    const update = vi.fn();
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      findBySaleId: vi.fn().mockResolvedValue([lot]),
      update,
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(
        mkSale({
          id: saleAId,
          deliveryMode: "online",
          allowOnlineBidsBeforeGoLive: false,
          startTime: saleStart,
          endTime: saleEnd,
        }),
      ),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });

    const result = await svc.update(
      "staff",
      lotId,
      {
        startTime: new Date("2026-05-31T10:00:00Z"),
        endTime: new Date("2026-06-03T18:00:00Z"),
      },
      "catalogue_manager",
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("before the sale start");
    }
    expect(update).not.toHaveBeenCalled();
  });
});

describe("LotService.updateMarketingDetails", () => {
  it("returns 403 for non-admin", async () => {
    const { svc, findById, updateMarketingDetails } = createSut({});
    const r = await svc.updateMarketingDetails("client", lotId, { artistNote: "z" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(AuthzError);
    expect(findById).not.toHaveBeenCalled();
    expect(updateMarketingDetails).not.toHaveBeenCalled();
  });

  it("returns 404 when lot missing", async () => {
    const { svc, findById } = createSut({});
    findById.mockResolvedValueOnce(null);
    const r = await svc.updateMarketingDetails("staff", lotId, { artistNote: "z" }, "super_admin");
    expect(r.isErr()).toBe(true);
    if (r.isErr() && r.error instanceof LotError) {
      expect(r.error.status).toBe(404);
    }
  });

  it("returns 400 for ended or cancelled", async () => {
    const { svc: s1 } = createSut({ lot: { status: "ended" } });
    const r1 = await s1.updateMarketingDetails("staff", lotId, { artistNote: "z" }, "super_admin");
    expect(r1.isErr()).toBe(true);

    const { svc: s2 } = createSut({ lot: { status: "cancelled" } });
    const r2 = await s2.updateMarketingDetails("staff", lotId, { artistNote: "z" }, "super_admin");
    expect(r2.isErr()).toBe(true);
  });

  it("updates via repo for admin and allowed status", async () => {
    const { svc, updateMarketingDetails } = createSut({});
    const r = await svc.updateMarketingDetails(
      "staff",
      lotId,
      { artistNote: "new" },
      "super_admin",
    );
    expect(r.isOk()).toBe(true);
    expect(updateMarketingDetails).toHaveBeenCalledWith(lotId, { artistNote: "new" });
  });
});

describe("LotService.cancel", () => {
  it("routes seller cancellation notifications to legal entity seller members", async () => {
    const activeLot: Lot = {
      ...baseLot,
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000010",
    };
    const cancelledLot: Lot = { ...activeLot, status: "cancelled" };
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValueOnce(activeLot).mockResolvedValueOnce(cancelledLot),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ILotRepository;
    const bids: IBidRepository = {
      listDistinctBidderIds: vi.fn().mockResolvedValue(["bidder-1"]),
    } as unknown as IBidRepository;
    const watchlist: IWatchlistRepository = {
      listUserIdsForLot: vi.fn().mockResolvedValue(["watcher-1"]),
    } as unknown as IWatchlistRepository;
    const lotNotifications: ILotNotificationCoordinator = {
      notifyLotCancelled: vi.fn().mockResolvedValue(undefined),
    };
    const legalEntityRecipients: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue(["owner-1", "consignor-1"]),
    };
    const svc = new LotService({
      lotRepo,
      bids,
      watchlist,
      jobScheduler: {
        scheduleLot: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotJobs: vi.fn().mockResolvedValue(undefined),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications,
      legalEntityNotificationRecipients: legalEntityRecipients,
    });

    const result = await svc.cancel("admin-1", "staff", lotId, "super_admin");

    expect(result.isOk()).toBe(true);
    expect(legalEntityRecipients.listUserIdsForAudience).toHaveBeenCalledWith(
      activeLot.sellerLegalEntityId,
      "seller",
    );
    expect(lotNotifications.notifyLotCancelled).toHaveBeenCalledWith({
      lotId,
      title: activeLot.title,
      recipientIds: ["bidder-1", "watcher-1", "owner-1", "consignor-1"],
    });
  });

  it("cancels lifecycle jobs after the lot status commit", async () => {
    const activeLot: Lot = { ...baseLot, status: "active" };
    const cancelledLot: Lot = { ...activeLot, status: "cancelled" };
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValueOnce(activeLot).mockResolvedValueOnce(cancelledLot),
      updateStatus,
    } as unknown as ILotRepository;
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const svc = new LotService({
      lotRepo,
      bids: { listDistinctBidderIds: vi.fn().mockResolvedValue([]) } as unknown as IBidRepository,
      watchlist: {
        listUserIdsForLot: vi.fn().mockResolvedValue([]),
      } as unknown as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotJobs,
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
    });

    const result = await svc.cancel("admin-1", "staff", lotId, "super_admin");
    expect(result.isOk()).toBe(true);
    expect(updateStatus.mock.invocationCallOrder[0]).toBeLessThan(
      cancelLotJobs.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(cancelLotJobs).toHaveBeenCalledWith(lotId);
  });
});

describe("LotService.publish", () => {
  const futureStart = new Date(Date.now() + 86_400_000);
  const futureEnd = new Date(Date.now() + 172_800_000);

  const draftLotBase: Lot = {
    ...baseLot,
    status: "draft",
    description: "Catalogue description",
    images: ["lot/a.jpg"],
    startTime: futureStart,
    endTime: futureEnd,
    sellerLegalEntityId: "ent-1",
  };

  it("returns 409 connect_required when individual seller Stripe Connect is not ready", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(draftLotBase),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const legalEntityRepository: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue(
        mkIndividualEntity({
          stripeConnectChargesEnabled: false,
          stripeConnectPayoutsEnabled: false,
        }),
      ),
    } as unknown as ILegalEntityRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotJobs: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
      legalEntityRepository,
      enforceIndividualConnectOnPublish: true,
    });
    const result = await svc.publish("admin", "staff", lotId, "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.code).toBe("connect_required");
      expect(result.error.status).toBe(409);
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("returns 409 connect_required when seller legal entity is missing", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(draftLotBase),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const legalEntityRepository: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ILegalEntityRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotJobs: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
      legalEntityRepository,
      enforceIndividualConnectOnPublish: true,
    });
    const result = await svc.publish("admin", "staff", lotId, "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.code).toBe("connect_required");
      expect(result.error.status).toBe(409);
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("schedules when individual seller Connect is ready and enforcement is on", async () => {
    const scheduled: Lot = { ...draftLotBase, status: "scheduled" };
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValueOnce(draftLotBase).mockResolvedValueOnce(scheduled),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ILotRepository;
    const legalEntityRepository: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue(mkIndividualEntity()),
    } as unknown as ILegalEntityRepository;
    const scheduler = {
      scheduleLot: vi.fn(),
      rescheduleEnd: vi.fn(),
      cancelLotJobs: vi.fn(),
      cancelLotEndJob: vi.fn(),
    };
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: scheduler,
      lotNotifications: null,
      legalEntityRepository,
      enforceIndividualConnectOnPublish: true,
    });
    const result = await svc.publish("admin", "staff", lotId, "super_admin");
    expect(result.isOk()).toBe(true);
    expect(lotRepo.updateStatus).toHaveBeenCalledWith(lotId, "scheduled");
    expect(scheduler.scheduleLot).toHaveBeenCalled();
  });

  it("does not enforce Connect when enforcement flag is off", async () => {
    const scheduled: Lot = { ...draftLotBase, status: "scheduled" };
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValueOnce(draftLotBase).mockResolvedValueOnce(scheduled),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ILotRepository;
    const legalEntityRepository: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue(
        mkIndividualEntity({
          stripeConnectChargesEnabled: false,
          stripeConnectPayoutsEnabled: false,
        }),
      ),
    } as unknown as ILegalEntityRepository;
    const scheduler = {
      scheduleLot: vi.fn(),
      rescheduleEnd: vi.fn(),
      cancelLotJobs: vi.fn(),
      cancelLotEndJob: vi.fn(),
    };
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: scheduler,
      lotNotifications: null,
      legalEntityRepository,
      enforceIndividualConnectOnPublish: false,
    });
    const result = await svc.publish("admin", "staff", lotId, "super_admin");
    expect(result.isOk()).toBe(true);
  });

  it("rejects publish when lot has no images", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue({ ...draftLotBase, images: [] }),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotJobs: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
    });
    const result = await svc.publish("admin", "staff", lotId, "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.message).toContain("image");
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects publish when lot has no catalogue description", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue({
        ...draftLotBase,
        images: ["lot/a.jpg"],
        description: "   ",
      }),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotJobs: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
    });
    const result = await svc.publish("admin", "staff", lotId, "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.message).toContain("description");
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("returns use_sale_publish when lot belongs to a draft sale", async () => {
    const lotOnDraftSale: Lot = { ...draftLotBase, saleId: saleBId };
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lotOnDraftSale),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(mkSale({ id: saleBId, status: "draft" })),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotJobs: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
    });
    const result = await svc.publish("admin", "staff", lotId, "catalogue_manager");
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.code).toBe("use_sale_publish");
      expect(result.error.status).toBe(409);
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("reverts to draft when scheduleLot fails after commit", async () => {
    const scheduled: Lot = { ...draftLotBase, status: "scheduled" };
    const scheduleLot = vi.fn().mockRejectedValue(new Error("redis down"));
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValueOnce(draftLotBase).mockResolvedValueOnce(scheduled),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot,
        rescheduleEnd: vi.fn(),
        cancelLotJobs,
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
    });
    const result = await svc.publish("admin", "staff", lotId, "super_admin");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        name: "LotError",
        code: "schedule_jobs_failed",
        status: 503,
      });
    }
    expect(lotRepo.updateStatus).toHaveBeenCalledWith(lotId, "scheduled");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith(lotId, "draft");
    expect(cancelLotJobs).toHaveBeenCalledWith(lotId);
    expect(scheduleLot).toHaveBeenCalled();
  });
});

describe("LotService.listBidsForPublicApi", () => {
  const bidRow: Bid = {
    id: "bid-1",
    lotId,
    placedByUserId: "bidder-user",
    buyerLegalEntityId: "00000000-0000-4000-8000-0000000000be",
    amount: "10",
    isWinning: true,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt: new Date(),
  };

  it("returns not_found when lot is missing", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ILotRepository;
    const bids: IBidRepository = { listForLot: vi.fn() } as unknown as IBidRepository;
    const svc = new LotService({
      lotRepo,
      bids,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    const r = await svc.listBidsForPublicApi({
      lotId,
      viewerRole: "client",
      viewerId: undefined,
      limitQuery: undefined,
    });
    expect(r).toEqual({ kind: "not_found" });
    expect(bids.listForLot).not.toHaveBeenCalled();
  });

  it("returns empty bids for sealed active lots when viewer cannot manage auction", async () => {
    const sealedActive: Lot = { ...baseLot, auctionType: "sealed", status: "active" };
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(sealedActive),
    } as unknown as ILotRepository;
    const listForLot = vi.fn();
    const bids: IBidRepository = { listForLot } as unknown as IBidRepository;
    const svc = new LotService({
      lotRepo,
      bids,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    const r = await svc.listBidsForPublicApi({
      lotId,
      viewerRole: "client",
      viewerId: undefined,
      limitQuery: undefined,
    });
    expect(r).toEqual({ kind: "ok", data: [] });
    expect(listForLot).not.toHaveBeenCalled();
  });

  it("lists bids for sealed active when viewer is staff with auction.manage", async () => {
    const sealedActive: Lot = { ...baseLot, auctionType: "sealed", status: "active" };
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(sealedActive),
    } as unknown as ILotRepository;
    const listForLot = vi.fn().mockResolvedValue([bidRow]);
    const bids: IBidRepository = { listForLot } as unknown as IBidRepository;
    const svc = new LotService({
      lotRepo,
      bids,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    const r = await svc.listBidsForPublicApi({
      lotId,
      viewerRole: "staff",
      viewerStaffRole: "super_admin",
      viewerId: "admin-1",
      limitQuery: "10",
    });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(listForLot).toHaveBeenCalledWith(lotId, 10);
    expect(r.data[0]?.placedByUserId).toBe("bidder-user");
    expect(r.data[0]?.bidderRef).toBe(lotBidderRef(lotId, "bidder-user"));
  });

  it("redacts placedByUserId for non-admin non-owner viewers", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(baseLot),
    } as unknown as ILotRepository;
    const listForLot = vi.fn().mockResolvedValue([bidRow]);
    const bids: IBidRepository = { listForLot } as unknown as IBidRepository;
    const svc = new LotService({
      lotRepo,
      bids,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    const r = await svc.listBidsForPublicApi({
      lotId,
      viewerRole: "client",
      viewerId: "someone-else",
      limitQuery: undefined,
    });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.data[0]?.placedByUserId).toBeNull();
    expect(r.data[0]?.bidderRef).toBe(lotBidderRef(lotId, "bidder-user"));
  });
});

describe("LotService.listLotsForPublicApi", () => {
  it("lists, presents images, and masks for viewer role", async () => {
    const list = vi.fn().mockResolvedValue([baseLot]);
    const lotRepo: ILotRepository = { list } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    const { data } = await svc.listLotsForPublicApi({ limit: 10, offset: 0 }, "client");
    expect(list).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      statuses: ["scheduled", "active"],
      requirePublicParentSale: true,
    });
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toBe(lotId);
  });

  it("passes needsPhotos filter to the repository for attention lens", async () => {
    const list = vi.fn().mockResolvedValue([]);
    const lotRepo: ILotRepository = { list } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    await svc.listLotsForPublicApi(
      { limit: 20, offset: 0, needsPhotos: true },
      "staff",
      "catalogue_manager",
    );
    expect(list).toHaveBeenCalledWith({ limit: 20, offset: 0, needsPhotos: true });
  });

  it("applies requirePublicParentSale for anonymous list queries", async () => {
    const list = vi.fn().mockResolvedValue([]);
    const lotRepo: ILotRepository = { list } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    await svc.listLotsForPublicApi({ limit: 10, offset: 0 }, "client");
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        requirePublicParentSale: true,
        statuses: ["scheduled", "active"],
      }),
    );
  });
});

describe("LotService.bulkPublishOrCancel", () => {
  it("returns AuthzError when role cannot manage catalogue", async () => {
    const lotRepo: ILotRepository = {} as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    const r = await svc.bulkPublishOrCancel("u1", "client", [lotId], "publish");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(AuthzError);
  });

  it("allows catalogue_manager staff to run bulk publish", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue({
        id: lotId,
        status: "draft",
        startTime: new Date(Date.now() + 86_400_000),
        endTime: new Date(Date.now() + 172_800_000),
        saleId: null,
        sellerLegalEntityId: null,
        title: "Lot",
        auctionType: "english",
        images: ["img.jpg"],
        description: "Catalogue description",
      }),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        cancelLotJobs: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
    });
    const r = await svc.bulkPublishOrCancel("u1", "staff", [lotId], "publish", "catalogue_manager");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.failed).toBe(0);
  });

  it("returns AuthzError when catalogue_manager runs bulk cancel", async () => {
    const lotRepo: ILotRepository = {} as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    const r = await svc.bulkPublishOrCancel("u1", "staff", [lotId], "cancel", "catalogue_manager");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toBeInstanceOf(AuthzError);
  });

  it("propagates connect_required code in bulk publish errors", async () => {
    const futureStart = new Date(Date.now() + 86_400_000);
    const futureEnd = new Date(Date.now() + 172_800_000);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue({
        id: lotId,
        status: "draft",
        startTime: futureStart,
        endTime: futureEnd,
        saleId: null,
        sellerLegalEntityId: "ent-1",
        title: "Lot",
        auctionType: "english",
        images: ["img.jpg"],
        description: "Catalogue description",
      }),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const legalEntityRepository: ILegalEntityRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ILegalEntityRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        cancelLotJobs: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
      legalEntityRepository,
      enforceIndividualConnectOnPublish: true,
    });
    const r = await svc.bulkPublishOrCancel("u1", "staff", [lotId], "publish", "catalogue_manager");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.failed).toBe(1);
      expect(r.value.errors[0]).toEqual(
        expect.objectContaining({ lotId, code: "connect_required" }),
      );
    }
  });

  it("propagates use_sale_publish code in bulk publish errors", async () => {
    const futureStart = new Date(Date.now() + 86_400_000);
    const futureEnd = new Date(Date.now() + 172_800_000);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue({
        id: lotId,
        status: "draft",
        startTime: futureStart,
        endTime: futureEnd,
        saleId: saleBId,
        sellerLegalEntityId: "ent-1",
        title: "Lot",
        auctionType: "english",
        images: ["img.jpg"],
        description: "Catalogue description",
      }),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(mkSale({ id: saleBId, status: "draft" })),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: {
        scheduleLot: vi.fn(),
        cancelLotJobs: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      lotNotifications: null,
    });
    const r = await svc.bulkPublishOrCancel("u1", "staff", [lotId], "publish", "catalogue_manager");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.failed).toBe(1);
      expect(r.value.errors[0]).toEqual(
        expect.objectContaining({ lotId, code: "use_sale_publish" }),
      );
    }
  });
});

describe("LotService.create sale membership", () => {
  const start = new Date(Date.now() + 86_400_000);
  const end = new Date(Date.now() + 172_800_000);
  const createInput: CreateLotInput = {
    title: "T",
    categoryId,
    auctionType: "english",
    startingPrice: "1",
    startTime: start,
    endTime: end,
    saleId: saleBId,
    sellerLegalEntityId: "ent-1",
  };

  it("rejects create when target sale is not draft", async () => {
    const lotRepo: ILotRepository = { create: vi.fn() } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(mkSale({ id: saleBId, status: "scheduled" })),
    } as unknown as ISaleRepository;
    const svc = new LotService({
      lotRepo,
      saleRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
    });
    const result = await svc.create("seller-1", createInput);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Lots can only be added while the sale is draft");
    }
    expect(lotRepo.create).not.toHaveBeenCalled();
  });
});

describe("LotService English-only policy", () => {
  const start = new Date(Date.now() + 86_400_000);
  const end = new Date(Date.now() + 172_800_000);
  const baseCreate: CreateLotInput = {
    title: "T",
    categoryId: categoryId,
    auctionType: "english",
    startingPrice: "1",
    startTime: start,
    endTime: end,
  };

  it("create rejects non-english auction type when flag is on", async () => {
    const lotRepo: ILotRepository = { create: vi.fn() } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
      englishOnlyAuctions: true,
    });
    const r = await svc.create("seller-1", { ...baseCreate, auctionType: "dutch" });
    expect(r.isErr()).toBe(true);
    expect(lotRepo.create).not.toHaveBeenCalled();
  });

  it("update rejects lateral change away from english when flag is on and lot was english", async () => {
    const englishDraft: Lot = {
      ...baseLot,
      status: "draft",
      auctionType: "english",
      startTime: start,
      endTime: end,
    };
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(englishDraft),
      update: vi.fn(),
    } as unknown as ILotRepository;
    const svc = new LotService({
      lotRepo,
      bids: {} as IBidRepository,
      watchlist: {} as IWatchlistRepository,
      jobScheduler: null,
      lotNotifications: null,
      englishOnlyAuctions: true,
    });
    const r = await svc.update("staff", lotId, { auctionType: "dutch" }, "super_admin");
    expect(r.isErr()).toBe(true);
    expect(lotRepo.update).not.toHaveBeenCalled();
  });
});
