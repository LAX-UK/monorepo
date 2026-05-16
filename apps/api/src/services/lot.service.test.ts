import type { Bid, CreateLotInput, LegalEntity, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import { lotBidderRef } from "../lib/lot-bidder-ref.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotNotificationCoordinator } from "./interfaces/lot-notifications.js";
import type { IBidRepository, ILotRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import { LotService } from "./lot.service.js";

const lotId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-0000000000c0";

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
});

describe("LotService.publish", () => {
  const futureStart = new Date(Date.now() + 86_400_000);
  const futureEnd = new Date(Date.now() + 172_800_000);

  const draftLotBase: Lot = {
    ...baseLot,
    status: "draft",
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
    expect(list).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toBe(lotId);
  });
});

describe("LotService.bulkPublishOrCancel", () => {
  it("returns AuthzError when role cannot manage auction", async () => {
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
