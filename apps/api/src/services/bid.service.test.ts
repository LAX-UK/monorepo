import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../lib/errors.js";
import { LotStrategyFactory } from "../strategies/strategy.factory.js";
import { BidService } from "./bid.service.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IAntiShillingGuard } from "./interfaces/anti-shilling.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IIdempotencyStore } from "./interfaces/idempotency-store.js";
import type { PlaceBidInput } from "./interfaces/place-bid.js";
import type { IBidRepository, ILotRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { ISaleModeLookup } from "./interfaces/sale-mode-lookup.js";
import { NotificationService } from "./notification.service.js";

const CAT = "c1000001-0000-4000-8000-000000000001";

function lot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "auc-1",
    saleId: null,
    lotNumber: null,
    sellerId: "seller-1",
    sellerLegalEntityId: "seller-entity-1",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: CAT,
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date(now.getTime() - 60_000),
    endTime: new Date(now.getTime() + 60 * 60_000),
    status: "active",
    winnerId: null,
    voidedReason: null,
    archivedSeller: false,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

function personalBid(
  placedByUserId: string,
  lotId: string,
  amount: number,
  maxAutoBidAmount?: number,
): PlaceBidInput {
  return {
    placedByUserId,
    buyerLegalEntityId: placedByUserId,
    lotId,
    amount,
    ...(maxAutoBidAmount !== undefined ? { maxAutoBidAmount } : {}),
  };
}

function createBid(partial: Partial<Bid> = {}): Bid {
  const now = new Date();
  const bidderId = partial.bidderId ?? partial.placedByUserId ?? "bidder-1";
  const buyerLegalEntityId = partial.buyerLegalEntityId ?? bidderId;
  return {
    id: "bid-1",
    lotId: "auc-1",
    bidderId,
    placedByUserId: bidderId,
    buyerLegalEntityId,
    amount: "150.00",
    isWinning: true,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt: now,
    ...partial,
  };
}

function baseBidRepo(overrides: Partial<IBidRepository> = {}): IBidRepository {
  return {
    create: vi.fn(),
    findHighestForLot: vi.fn(),
    listForLotSettlement: vi.fn(),
    findEligibleBidsForLotClose: vi.fn().mockResolvedValue([]),
    listForLot: vi.fn().mockResolvedValue([]),
    listForBidder: vi.fn(),
    findWinningBid: vi.fn().mockResolvedValue(null),
    listDistinctBidderIds: vi.fn(),
    markWinningBid: vi.fn(),
    aggregateBidderCeilings: vi.fn().mockResolvedValue(new Map<string, number>()),
    listBidderCeilingStates: vi.fn().mockResolvedValue([]),
    bidderHasProxyMaxOnLot: vi.fn().mockResolvedValue(false),
    clearProxyAutoBidForBidderOnLot: vi.fn().mockResolvedValue(0),
    listActiveProxyBidPairsForBuyerEntity: vi.fn().mockResolvedValue([]),
    listActiveProxyBidPairsForMemberOnEntity: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function baseLotRepo(overrides: Partial<ILotRepository> = {}): ILotRepository {
  return {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    countMatching: vi.fn().mockResolvedValue(0),
    sumEndedHammer: vi.fn().mockResolvedValue({ total: "0", count: 0 }),
    updateCurrentPrice: vi.fn(),
    updateEndTime: vi.fn(),
    updateStatus: vi.fn(),
    update: vi.fn(),
    setWinner: vi.fn(),
    findScheduledToActivate: vi.fn().mockResolvedValue([]),
    findActivePastEnd: vi.fn().mockResolvedValue([]),
    findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
    findActiveDutchLots: vi.fn().mockResolvedValue([]),
    setDutchLastDecrementAt: vi.fn(),
    updateDutchCurrentPrice: vi.fn(),
    updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
    clearSaleId: vi.fn(),
    findBySaleId: vi.fn(),
    findBySaleIds: vi.fn().mockResolvedValue([]),
    voidLotAntiShillingClose: vi.fn(),
    markArchivedSellerOnDraftScheduledLots: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as ILotRepository;
}

const mockTxForBids = {
  insert: () => ({
    values: vi.fn().mockResolvedValue(undefined),
  }),
} as const;

function createMockFactory(lotRepo: ILotRepository, bidRepo: IBidRepository): IRepositoryFactory {
  const repos = { lot: lotRepo, bid: bidRepo };
  return {
    root: repos,
    forConnection: () => repos,
    runInTransaction: async <T>(fn: (r: typeof repos, tx: Database) => Promise<T>) =>
      fn(repos, mockTxForBids as unknown as Database),
  };
}

describe("BidService.placeBid", () => {
  const strategyFactory = new LotStrategyFactory();

  it("returns Err when lot is not found", async () => {
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(null),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const bidNotif = { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) };
    const lotNotif = {
      notifyLotExtended: vi.fn().mockResolvedValue(undefined),
      notifyLotEnded: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, lotNotif);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(BidError);
      expect(result.error.message).toBe("Lot not found");
      expect(result.error.status).toBe(404);
    }
  });

  it("returns Err when lot is not active", async () => {
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(lot({ status: "ended" })),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const bidNotif = { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) };
    const lotNotif = {
      notifyLotExtended: vi.fn().mockResolvedValue(undefined),
      notifyLotEnded: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, lotNotif);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("Lot is not accepting bids");
  });

  it("returns Err when bid fails strategy validation", async () => {
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(lot({ currentPrice: "200.00" })),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const bidNotif = { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) };
    const lotNotif = {
      notifyLotExtended: vi.fn().mockResolvedValue(undefined),
      notifyLotEnded: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, lotNotif);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 100));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toContain("Bid must be at least");
  });

  it("creates bid, updates cache, and notifies on success", async () => {
    const active = lot({ currentPrice: "100.00" });
    const created = createBid({ amount: "150.00" });

    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cacheSet = vi.fn().mockResolvedValue(undefined);
    const cache: ICacheProvider = { set: cacheSet, get: vi.fn(), del: vi.fn() };
    const notifyBidPlaced = vi.fn().mockResolvedValue(undefined);
    const notifyLotExtended = vi.fn().mockResolvedValue(undefined);
    const notifyLotEnded = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced },
      { notifyLotExtended, notifyLotEnded },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(created);

    expect(bidRepo.create).toHaveBeenCalledOnce();
    expect(bidRepo.markWinningBid).toHaveBeenCalledWith("auc-1", "bid-1");
    expect(lotRepo.updateCurrentPrice).toHaveBeenCalledWith("auc-1", "150.00");
    expect(cacheSet).toHaveBeenCalledWith("lot:auc-1:currentPrice", "150.00", 3600);
    expect(notifyBidPlaced).toHaveBeenCalledOnce();
    expect(notifyLotExtended).not.toHaveBeenCalled();
    expect(notifyLotEnded).not.toHaveBeenCalled();
  });

  it("rejects bid when bidder is a member of the seller legal entity", async () => {
    const sellerLegalEntityId = "00000000-0000-4000-8000-000000000010";
    const active = lot({ currentPrice: "100.00", sellerLegalEntityId });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn() },
    );
    const antiShillingGuard: IAntiShillingGuard = {
      bidderSharesSellerLegalEntity: vi.fn(),
      violatesAntiShilling: vi.fn().mockResolvedValue(true),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
      antiShillingGuard,
    });

    const result = await service.placeBid(personalBid("org-member", "auc-1", 150));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(BidError);
      expect(result.error.message).toBe("Seller cannot bid on own lot");
      expect(result.error.status).toBe(400);
    }
    expect(antiShillingGuard.violatesAntiShilling).toHaveBeenCalledWith({
      bidderUserId: "org-member",
      buyerLegalEntityId: "org-member",
      lot: active,
    });
    expect(bidRepo.create).not.toHaveBeenCalled();
  });

  it("allows bid when bidder is not a member of the seller legal entity", async () => {
    const active = lot({
      currentPrice: "100.00",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000010",
    });
    const created = createBid({ amount: "150.00", bidderId: "buyer-1" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn() },
    );
    const antiShillingGuard: IAntiShillingGuard = {
      bidderSharesSellerLegalEntity: vi.fn(),
      violatesAntiShilling: vi.fn().mockResolvedValue(false),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
      antiShillingGuard,
    });

    const result = await service.placeBid(personalBid("buyer-1", "auc-1", 150));

    expect(result.isOk()).toBe(true);
    expect(antiShillingGuard.violatesAntiShilling).toHaveBeenCalledWith({
      bidderUserId: "buyer-1",
      buyerLegalEntityId: "buyer-1",
      lot: active,
    });
    expect(bidRepo.create).toHaveBeenCalledOnce();
  });

  it("skips proxy auto-bid candidates that share the seller legal entity", async () => {
    const active = lot({
      currentPrice: "100.00",
      sellerLegalEntityId: "00000000-0000-4000-8000-000000000010",
    });
    const directBid = createBid({
      id: "bid-direct",
      bidderId: "buyer-1",
      amount: "150.00",
      isAutoBid: true,
      maxAutoBidAmount: "200.00",
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const domainPublish = vi.fn().mockResolvedValue(undefined);
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(directBid),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
      aggregateBidderCeilings: vi
        .fn()
        .mockResolvedValue(new Map<string, number>([["seller-member", 500]])),
      listBidderCeilingStates: vi.fn().mockResolvedValue([
        {
          bidderId: "buyer-1",
          buyerLegalEntityId: "00000000-0000-4000-8000-000000000020",
          ceiling: 200,
        },
        {
          bidderId: "seller-member",
          buyerLegalEntityId: "00000000-0000-4000-8000-000000000021",
          ceiling: 500,
        },
      ]),
      bidderHasProxyMaxOnLot: vi
        .fn()
        .mockImplementation((_lotId: string, bidderId: string) =>
          Promise.resolve(bidderId === "seller-member"),
        ),
      clearProxyAutoBidForBidderOnLot: vi.fn().mockResolvedValue(2),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn() },
    );
    const antiShillingGuard: IAntiShillingGuard = {
      bidderSharesSellerLegalEntity: vi.fn(),
      violatesAntiShilling: vi
        .fn()
        .mockImplementation((ctx) => Promise.resolve(ctx.bidderUserId === "seller-member")),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
      antiShillingGuard,
      domainEventPublisher: { publish: domainPublish } as unknown as DomainEventPublisher,
    });

    const result = await service.placeBid(personalBid("buyer-1", "auc-1", 150, 200));

    expect(result.isOk()).toBe(true);
    expect(bidRepo.create).toHaveBeenCalledTimes(1);
    expect(bidRepo.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ bidderId: "seller-member" }),
    );
    expect(antiShillingGuard.violatesAntiShilling).toHaveBeenCalledWith(
      expect.objectContaining({ bidderUserId: "seller-member", lot: active }),
    );
    expect(bidRepo.clearProxyAutoBidForBidderOnLot).toHaveBeenCalledWith("auc-1", "seller-member");
    expect(domainPublish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "bid.proxy_cancelled",
        payload: expect.objectContaining({ reason: "anti_shilling_violation" }),
      }),
    );
  });

  it("inserts contested bids as non-winning before atomically promoting the new winner", async () => {
    const active = lot({ currentPrice: "100.00" });
    const previousWinner = createBid({
      id: "bid-prev",
      bidderId: "bidder-prev",
      amount: "125.00",
    });
    const created = createBid({ id: "bid-new", bidderId: "bidder-new", amount: "150.00" });

    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      findWinningBid: vi.fn().mockResolvedValue(previousWinner),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn() },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
    });

    const result = await service.placeBid(personalBid("bidder-new", "auc-1", 150));

    expect(result.isOk()).toBe(true);
    expect(bidRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        placedByUserId: "bidder-new",
        buyerLegalEntityId: "bidder-new",
        isWinning: false,
        lotId: "auc-1",
      }),
    );
    expect(bidRepo.markWinningBid).toHaveBeenCalledOnce();
    expect(bidRepo.markWinningBid).toHaveBeenCalledWith("auc-1", "bid-new");
  });

  it("ends Dutch lot on first acceptance and cancels lifecycle jobs", async () => {
    const now = new Date();
    const active = lot({
      auctionType: "dutch",
      currentPrice: "50.00",
      endTime: new Date(now.getTime() + 60 * 60_000),
    });
    const created = createBid({ amount: "50.00", bidderId: "buyer-1" });

    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifyBidPlaced = vi.fn().mockResolvedValue(undefined);
    const notifyLotEnded = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced },
      { notifyLotExtended: vi.fn(), notifyLotEnded },
    );
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: { rescheduleEnd: vi.fn(), cancelLotJobs },
    });

    const result = await service.placeBid(personalBid("buyer-1", "auc-1", 50));
    expect(result.isOk()).toBe(true);
    expect(lotRepo.setWinner).toHaveBeenCalledWith("auc-1", "buyer-1", "buyer-1");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith("auc-1", "ended");
    expect(cancelLotJobs).toHaveBeenCalledWith("auc-1");
    expect(notifyLotEnded).toHaveBeenCalledOnce();
  });

  it("rejects Dutch bid when English-only catalogue mode is on", async () => {
    const now = new Date();
    const active = lot({
      auctionType: "dutch",
      currentPrice: "50.00",
      endTime: new Date(now.getTime() + 60 * 60_000),
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn() },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn() },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: {
        rescheduleEnd: vi.fn(),
        cancelLotJobs: vi.fn().mockResolvedValue(undefined),
      },
      englishOnlyAuctions: true,
    });

    const result = await service.placeBid(personalBid("buyer-1", "auc-1", 50));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(BidError);
      expect(result.error.code).toBe("english_only_catalogue");
    }
    expect(bidRepo.create).not.toHaveBeenCalled();
  });

  it("rejects bid when parent sale is onsite (read-only)", async () => {
    const lotRepo = baseLotRepo({
      // findByIdForUpdate should NOT be reached when the sale-mode gate denies
      findByIdForUpdate: vi.fn().mockResolvedValue(lot()),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const bidNotif = { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) };
    const lotNotif = {
      notifyLotExtended: vi.fn().mockResolvedValue(undefined),
      notifyLotEnded: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, lotNotif);
    const saleModeLookup: ISaleModeLookup = {
      findSaleModeForLot: vi.fn().mockResolvedValue("onsite"),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
      saleModeLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(BidError);
      expect(result.error.message).toBe("Lot is not accepting bids");
      expect(result.error.status).toBe(400);
    }
    expect(saleModeLookup.findSaleModeForLot).toHaveBeenCalledWith("auc-1");
    expect(lotRepo.findByIdForUpdate).not.toHaveBeenCalled();
    expect(bidRepo.create).not.toHaveBeenCalled();
  });

  it("allows bid when parent sale is online", async () => {
    const active = lot({ currentPrice: "100.00" });
    const created = createBid({ amount: "150.00" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifyBidPlaced = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn() },
    );
    const saleModeLookup: ISaleModeLookup = {
      findSaleModeForLot: vi.fn().mockResolvedValue("online"),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
      saleModeLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isOk()).toBe(true);
    expect(saleModeLookup.findSaleModeForLot).toHaveBeenCalledWith("auc-1");
    expect(lotRepo.findByIdForUpdate).toHaveBeenCalled();
    expect(bidRepo.create).toHaveBeenCalledOnce();
  });

  it("ends buy-it-now lot when bid meets buy-now price", async () => {
    const now = new Date();
    const active = lot({
      auctionType: "buy_it_now",
      currentPrice: "100.00",
      buyNowPrice: "500.00",
      endTime: new Date(now.getTime() + 60 * 60_000),
    });
    const created = createBid({ amount: "500.00", bidderId: "buyer-1" });

    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifyBidPlaced = vi.fn().mockResolvedValue(undefined);
    const notifyLotEnded = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced },
      { notifyLotExtended: vi.fn(), notifyLotEnded },
    );
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: { rescheduleEnd: vi.fn(), cancelLotJobs },
    });

    const result = await service.placeBid(personalBid("buyer-1", "auc-1", 500));
    expect(result.isOk()).toBe(true);
    expect(lotRepo.setWinner).toHaveBeenCalledWith("auc-1", "buyer-1", "buyer-1");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith("auc-1", "ended");
    expect(cancelLotJobs).toHaveBeenCalledWith("auc-1");
    expect(notifyLotEnded).toHaveBeenCalledOnce();
  });
});

describe("BidService.placeBidWithIdempotency", () => {
  const strategyFactory = new LotStrategyFactory();

  it("replays cached payload when idempotency store returns a hit", async () => {
    const cachedBid = createBid({ id: "bid-replay" });
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(JSON.stringify({ data: cachedBid })),
      setWithExpiry: vi.fn(),
    };
    const lotRepo = baseLotRepo();
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn() },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn() },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      notificationDispatcher: null,
      lotJobs: null,
      idempotencyStore,
    });
    const out = await service.placeBidWithIdempotency({
      placedByUserId: "u1",
      idempotencyKey: "k1",
      lotId: "auc-1",
      amount: 100,
    });
    expect(out.type).toBe("replay");
    if (out.type === "replay") {
      expect(out.body.data.id).toBe("bid-replay");
    }
    expect(idempotencyStore.setWithExpiry).not.toHaveBeenCalled();
  });
});
