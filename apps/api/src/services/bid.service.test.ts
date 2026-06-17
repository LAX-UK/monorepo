import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { err } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../lib/errors.js";
import { LotStrategyFactory } from "../strategies/strategy.factory.js";
import { BidService } from "./bid.service.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IAntiShillingGuard } from "./interfaces/anti-shilling.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IIdempotencyStore } from "./interfaces/idempotency-store.js";
import type { PlaceBidInput } from "./interfaces/place-bid.js";
import type { IBidRepository, ILotRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { ISaleModeLookup } from "./interfaces/sale-mode-lookup.js";
import type { ISaleroomSessionLookup } from "./interfaces/saleroom-session-lookup.js";
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
    countForLot: vi.fn().mockResolvedValue(1),
    listForBidder: vi.fn(),
    findWinningBid: vi.fn().mockResolvedValue(null),
    listDistinctBidderIds: vi.fn(),
    markWinningBid: vi.fn(),
    aggregateBidderCeilings: vi.fn().mockResolvedValue(new Map<string, number>()),
    listBidderCeilingStates: vi.fn().mockResolvedValue([]),
    updateProxySettingsForBidderOnLot: vi.fn().mockResolvedValue(undefined),
    findProxySettingsForBidderOnLot: vi.fn().mockResolvedValue(null),
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

function createMockTxWithSaleroomSession(
  session: { status: string; currentLotId: string | null } | null,
) {
  return {
    insert: () => ({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(session ? [session] : []),
        }),
      }),
    }),
  } as const;
}

function createSaleroomSessionLookupMock(
  opts: { skipAntiSnipe?: boolean; enforceOnBlock?: boolean } = {},
): ISaleroomSessionLookup {
  return {
    shouldSkipAntiSnipeForLot: vi.fn().mockResolvedValue(opts.skipAntiSnipe ?? false),
    shouldEnforceOnBlockGateForLot: vi.fn().mockResolvedValue(opts.enforceOnBlock ?? false),
  };
}

function createMockFactory(
  lotRepo: ILotRepository,
  bidRepo: IBidRepository,
  mockTx: typeof mockTxForBids | ReturnType<typeof createMockTxWithSaleroomSession> = mockTxForBids,
): IRepositoryFactory {
  const repos = { lot: lotRepo, bid: bidRepo };
  return {
    root: repos,
    forConnection: () => repos,
    runInTransaction: async <T>(fn: (r: typeof repos, tx: Database) => Promise<T>) =>
      fn(repos, mockTx as unknown as Database),
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
      notifyProxyCancelled: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, lotNotif);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
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

  it("returns Err when bidEligibility rejects the bid", async () => {
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn(),
    });
    const bidEligibility: IBidEligibility = {
      assertCanPlaceBid: vi
        .fn()
        .mockResolvedValue(
          err(new BidError("Bid exceeds your approved limit", 403, "bid_limit_exceeded")),
        ),
    };
    const legalEntityRepository = {
      findById: vi.fn().mockResolvedValue({ id: "le-agent", status: "approved" }),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, baseBidRepo()),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      bidEligibility,
      legalEntityRepository: legalEntityRepository as never,
    });

    const result = await service.placeBid({
      placedByUserId: "u1",
      buyerLegalEntityId: "le-agent",
      lotId: "auc-1",
      amount: 999_999,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("bid_limit_exceeded");
    }
    expect(lotRepo.findByIdForUpdate).not.toHaveBeenCalled();
    expect(bidEligibility.assertCanPlaceBid).toHaveBeenCalledWith({
      placedByUserId: "u1",
      buyerLegalEntityId: "le-agent",
      lotId: "auc-1",
      amount: 999_999,
    });
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
      notifyProxyCancelled: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, lotNotif);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
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
      notifyProxyCancelled: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, lotNotif);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
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
      { notifyLotExtended, notifyLotEnded, notifyProxyCancelled: vi.fn() },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
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
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
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
      lotJobs: null,
      antiShillingGuard,
    });

    const result = await service.placeBid(personalBid("org-member", "auc-1", 150));

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(BidError);
      expect(result.error.message).toBe("Seller cannot bid on own lot");
      expect(result.error.status).toBe(400);
      expect(result.error.code).toBe("seller_cannot_bid");
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
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
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
          ceiling: "200.00",
        },
        {
          bidderId: "seller-member",
          buyerLegalEntityId: "00000000-0000-4000-8000-000000000021",
          ceiling: "500.00",
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
    const notifyProxyCancelled = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled },
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
      lotJobs: null,
      antiShillingGuard,
      domainEventPublisher: { publish: domainPublish } as unknown as DomainEventPublisher,
    });

    const result = await service.placeBid(personalBid("buyer-1", "auc-1", 150, 200));

    expect(result.isOk()).toBe(true);
    expect(bidRepo.create).toHaveBeenCalledTimes(1);
    expect(bidRepo.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ placedByUserId: "seller-member" }),
    );
    expect(antiShillingGuard.violatesAntiShilling).toHaveBeenCalledWith(
      expect.objectContaining({ bidderUserId: "seller-member", lot: active }),
    );
    expect(bidRepo.clearProxyAutoBidForBidderOnLot).toHaveBeenCalledWith("auc-1", "seller-member");
    expect(notifyProxyCancelled).toHaveBeenCalledWith(
      "auc-1",
      "seller-member",
      "anti_shilling_violation",
    );
    expect(domainPublish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "bid.proxy_cancelled",
        payload: expect.objectContaining({ reason: "anti_shilling_violation" }),
      }),
    );
  });

  it("uses per-bidder auto-bid step amounts in proxy resolution", async () => {
    const active = lot({ currentPrice: "100.00", minBidIncrement: "10.00" });
    const directBid = createBid({
      id: "bid-direct",
      bidderId: "buyer-a",
      amount: "110.00",
      isAutoBid: true,
      maxAutoBidAmount: "500.00",
      autoBidStepAmount: "10.00",
    });
    const proxyBid = createBid({
      id: "bid-proxy",
      bidderId: "buyer-a",
      amount: "310.00",
      isAutoBid: true,
      maxAutoBidAmount: "500.00",
      autoBidStepAmount: "10.00",
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValueOnce(directBid).mockResolvedValueOnce(proxyBid),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
      listBidderCeilingStates: vi
        .fn()
        .mockResolvedValueOnce([
          {
            bidderId: "buyer-a",
            buyerLegalEntityId: "buyer-a",
            ceiling: "500.00",
            autoBidStepAmount: "10.00",
          },
          {
            bidderId: "buyer-b",
            buyerLegalEntityId: "buyer-b",
            ceiling: "300.00",
            autoBidStepAmount: "20.00",
          },
        ])
        .mockResolvedValue([]),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      lotJobs: null,
      antiShillingGuard: null,
    });

    const result = await service.placeBid({
      ...personalBid("buyer-a", "auc-1", 110, 500),
      autoBidStepAmount: 10,
    });

    expect(result.isOk()).toBe(true);
    expect(bidRepo.create).toHaveBeenCalledTimes(2);
    expect(bidRepo.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        placedByUserId: "buyer-a",
        amount: "310.00",
        isAutoBid: true,
        autoBidStepAmount: "10.00",
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
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
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
      { notifyLotExtended: vi.fn(), notifyLotEnded, notifyProxyCancelled: vi.fn() },
    );
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
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
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
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
      notifyProxyCancelled: vi.fn().mockResolvedValue(undefined),
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

  it("allows operator telephone bid on onsite sale (legacy bypass)", async () => {
    const active = lot({ currentPrice: "100.00" });
    const created = createBid({ amount: "150.00" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const saleModeLookup: ISaleModeLookup = {
      findSaleModeForLot: vi.fn().mockResolvedValue("onsite"),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      saleModeLookup,
    });

    const result = await service.placeBid({
      placedByUserId: "buyer-1",
      buyerLegalEntityId: "buyer-1",
      lotId: "auc-1",
      amount: 150,
      placement: { placedVia: "telephone", clerkUserId: "clerk-1" },
    });

    expect(result.isOk()).toBe(true);
    expect(bidRepo.create).toHaveBeenCalledOnce();
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
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
    );
    const saleModeLookup: ISaleModeLookup = {
      findSaleModeForLot: vi.fn().mockResolvedValue("online"),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      lotJobs: null,
      saleModeLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isOk()).toBe(true);
    expect(saleModeLookup.findSaleModeForLot).toHaveBeenCalledWith("auc-1");
    expect(lotRepo.findByIdForUpdate).toHaveBeenCalled();
    expect(bidRepo.create).toHaveBeenCalledOnce();
  });

  it("allows web bid when parent sale is hybrid", async () => {
    const active = lot({ currentPrice: "100.00", saleId: "sale-hybrid" });
    const created = createBid({ amount: "150.00" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const saleModeLookup: ISaleModeLookup = {
      findSaleModeForLot: vi.fn().mockResolvedValue("hybrid"),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      saleModeLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isOk()).toBe(true);
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
      listDistinctBidderIds: vi.fn().mockResolvedValue(["buyer-1", "buyer-2"]),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifyBidPlaced = vi.fn().mockResolvedValue(undefined);
    const notifyLotEnded = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced },
      { notifyLotExtended: vi.fn(), notifyLotEnded, notifyProxyCancelled: vi.fn() },
    );
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      lotJobs: { rescheduleEnd: vi.fn(), cancelLotJobs },
      notificationOutbox: { stageDispatch },
    });

    const result = await service.placeBid(personalBid("buyer-1", "auc-1", 500));
    expect(result.isOk()).toBe(true);
    expect(lotRepo.setWinner).toHaveBeenCalledWith("auc-1", "buyer-1", "buyer-1");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith("auc-1", "ended");
    expect(cancelLotJobs).toHaveBeenCalledWith("auc-1");
    expect(notifyLotEnded).toHaveBeenCalledOnce();
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "buyer-1",
        idempotencyKey: "lot_won:auc-1:buyer-1",
      }),
      expect.anything(),
    );
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "buyer-2",
        idempotencyKey: "lot_lost:auc-1:buyer-2",
      }),
      expect.anything(),
    );
  });

  it("extends lot end time and reschedules jobs when bid arrives in anti-sniping window", async () => {
    const now = Date.now();
    const active = lot({
      currentPrice: "100.00",
      endTime: new Date(now + 60_000),
    });
    const created = createBid({ amount: "150.00" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn(),
    });
    const notifyLotExtended = vi.fn().mockResolvedValue(undefined);
    const rescheduleEnd = vi.fn().mockResolvedValue(undefined);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
        { notifyLotExtended, notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: { rescheduleEnd, cancelLotJobs: vi.fn() },
      bidPolicy: {
        antiSnipingWindowMs: 120_000,
        antiSnipingExtensionMs: 30_000,
      },
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isOk()).toBe(true);
    expect(lotRepo.updateEndTime).toHaveBeenCalledOnce();
    expect(notifyLotExtended).toHaveBeenCalledOnce();
    expect(rescheduleEnd).toHaveBeenCalledOnce();
  });

  it("skips anti-sniping extension when live saleroom session controls close", async () => {
    const now = Date.now();
    const active = lot({
      saleId: "sale-hybrid",
      currentPrice: "100.00",
      endTime: new Date(now + 60_000),
    });
    const created = createBid({ amount: "150.00" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn(),
    });
    const saleroomSessionLookup = createSaleroomSessionLookupMock({
      skipAntiSnipe: true,
      enforceOnBlock: true,
    });
    const service = new BidService({
      repos: createMockFactory(
        lotRepo,
        bidRepo,
        createMockTxWithSaleroomSession({ status: "live", currentLotId: "auc-1" }),
      ),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: { rescheduleEnd: vi.fn(), cancelLotJobs: vi.fn() },
      saleroomSessionLookup,
      bidPolicy: {
        antiSnipingWindowMs: 120_000,
        antiSnipingExtensionMs: 30_000,
      },
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isOk()).toBe(true);
    expect(lotRepo.updateEndTime).not.toHaveBeenCalled();
    expect(saleroomSessionLookup.shouldSkipAntiSnipeForLot).toHaveBeenCalledWith("auc-1");
  });

  it("allows bids after catalog endTime when live saleroom session controls close", async () => {
    const active = lot({
      saleId: "sale-hybrid",
      currentPrice: "100.00",
      endTime: new Date(Date.now() - 60_000),
    });
    const created = createBid({ amount: "150.00" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn(),
    });
    const saleroomSessionLookup = createSaleroomSessionLookupMock({
      skipAntiSnipe: true,
      enforceOnBlock: true,
    });
    const service = new BidService({
      repos: createMockFactory(
        lotRepo,
        bidRepo,
        createMockTxWithSaleroomSession({ status: "live", currentLotId: "auc-1" }),
      ),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      saleroomSessionLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isOk()).toBe(true);
    expect(saleroomSessionLookup.shouldSkipAntiSnipeForLot).toHaveBeenCalledWith("auc-1");
  });

  it("rejects web bid when lot is not on block during live saleroom", async () => {
    const active = lot({
      saleId: "sale-hybrid",
      currentPrice: "100.00",
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const saleroomSessionLookup = createSaleroomSessionLookupMock({
      skipAntiSnipe: true,
      enforceOnBlock: true,
    });
    const service = new BidService({
      repos: createMockFactory(
        lotRepo,
        baseBidRepo(),
        createMockTxWithSaleroomSession({ status: "live", currentLotId: "other-lot" }),
      ),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      saleroomSessionLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("lot_not_on_block");
    }
  });

  it("rejects all bids when saleroom session is paused", async () => {
    const active = lot({
      saleId: "sale-hybrid",
      currentPrice: "100.00",
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const saleroomSessionLookup = createSaleroomSessionLookupMock({
      skipAntiSnipe: true,
      enforceOnBlock: true,
    });
    const service = new BidService({
      repos: createMockFactory(
        lotRepo,
        baseBidRepo(),
        createMockTxWithSaleroomSession({ status: "paused", currentLotId: "auc-1" }),
      ),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      saleroomSessionLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("saleroom_paused");
    }
  });

  it("rejects gated hybrid web bid before Go Live", async () => {
    const active = lot({
      saleId: "sale-hybrid",
      currentPrice: "100.00",
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const saleroomSessionLookup = createSaleroomSessionLookupMock({
      skipAntiSnipe: false,
      enforceOnBlock: true,
    });
    const service = new BidService({
      repos: createMockFactory(lotRepo, baseBidRepo(), createMockTxWithSaleroomSession(null)),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      saleroomSessionLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("lot_not_on_block");
    }
    expect(saleroomSessionLookup.shouldEnforceOnBlockGateForLot).toHaveBeenCalledWith("auc-1");
  });

  it("allows open hybrid web bid before Go Live when sale opts into early online bidding", async () => {
    const active = lot({
      saleId: "sale-hybrid",
      currentPrice: "100.00",
    });
    const created = createBid({ amount: "150.00" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn(),
    });
    const saleroomSessionLookup = createSaleroomSessionLookupMock({
      skipAntiSnipe: false,
      enforceOnBlock: false,
    });
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo, createMockTxWithSaleroomSession(null)),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      saleroomSessionLookup,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    expect(result.isOk()).toBe(true);
    expect(saleroomSessionLookup.shouldEnforceOnBlockGateForLot).toHaveBeenCalledWith("auc-1");
  });

  it("chains anti-sniping extensions for consecutive bids in the window", async () => {
    const now = Date.now();
    let endTime = new Date(now + 60_000);
    const created = createBid({ amount: "150.00" });
    const updateEndTime = vi.fn().mockImplementation(async (_id: string, next: Date) => {
      endTime = next;
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockImplementation(async () =>
        lot({
          currentPrice: "100.00",
          endTime,
        }),
      ),
      updateEndTime,
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn(),
    });
    const rescheduleEnd = vi.fn().mockResolvedValue(undefined);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: { rescheduleEnd, cancelLotJobs: vi.fn() },
      bidPolicy: {
        antiSnipingWindowMs: 120_000,
        antiSnipingExtensionMs: 30_000,
      },
    });

    await service.placeBid(personalBid("bidder-1", "auc-1", 150));
    await service.placeBid(personalBid("bidder-2", "auc-1", 160));
    expect(updateEndTime).toHaveBeenCalledTimes(2);
    expect(rescheduleEnd).toHaveBeenCalledTimes(2);
  });

  it("rejects bid when bidder is already leading", async () => {
    const active = lot({ currentPrice: "150.00" });
    const previousWinner = createBid({
      id: "bid-prev",
      bidderId: "bidder-1",
      amount: "150.00",
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      findWinningBid: vi.fn().mockResolvedValue(previousWinner),
    });
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
    });

    const result = await service.placeBid(personalBid("bidder-1", "auc-1", 160));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("already_leading");
    }
    expect(bidRepo.create).not.toHaveBeenCalled();
  });

  it("allows operator telephone bid when buyer is already leading", async () => {
    const active = lot({ currentPrice: "150.00" });
    const previousWinner = createBid({
      id: "bid-prev",
      bidderId: "buyer-1",
      amount: "150.00",
    });
    const created = createBid({ id: "bid-tel", bidderId: "buyer-1", amount: "160.00" });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      findWinningBid: vi.fn().mockResolvedValue(previousWinner),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
    });

    const result = await service.placeBid({
      placedByUserId: "buyer-1",
      buyerLegalEntityId: "buyer-1",
      lotId: "auc-1",
      amount: 160,
      placement: { placedVia: "telephone" },
    });

    expect(result.isOk()).toBe(true);
    expect(bidRepo.create).toHaveBeenCalledOnce();
  });

  it("stages outbid notification in outbox for previous winner", async () => {
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
      markWinningBid: vi.fn(),
    });
    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        {
          notifyBidPlaced: vi.fn().mockResolvedValue(undefined),
        },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      notificationOutbox: { stageDispatch },
      lotJobs: null,
    });

    const result = await service.placeBid(personalBid("bidder-new", "auc-1", 150));
    expect(result.isOk()).toBe(true);
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "bidder-prev",
        idempotencyKey: "outbid:auc-1:bid-new:bidder-prev",
      }),
      expect.anything(),
    );
  });

  it("settles proxy in one step for large ceiling gap", async () => {
    const active = lot({ currentPrice: "100.00", minBidIncrement: "1.00" });
    const directBid = createBid({
      id: "bid-direct",
      bidderId: "buyer-high",
      amount: "101.00",
      isAutoBid: true,
      maxAutoBidAmount: "10000.00",
    });
    const proxyBid = createBid({
      id: "bid-proxy",
      bidderId: "buyer-high",
      amount: "5001.00",
      isAutoBid: true,
      maxAutoBidAmount: "10000.00",
    });
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValueOnce(directBid).mockResolvedValueOnce(proxyBid),
      markWinningBid: vi.fn(),
      listBidderCeilingStates: vi.fn().mockResolvedValue([
        {
          bidderId: "buyer-high",
          buyerLegalEntityId: "buyer-high",
          ceiling: "10000.00",
          autoBidStepAmount: "1.00",
          maxCreatedAt: new Date("2020-01-01T00:00:00Z"),
        },
        {
          bidderId: "buyer-low",
          buyerLegalEntityId: "buyer-low",
          ceiling: "5000.00",
          autoBidStepAmount: "1.00",
          maxCreatedAt: new Date("2020-01-02T00:00:00Z"),
        },
      ]),
    });
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
    });

    const result = await service.placeBid({
      ...personalBid("buyer-high", "auc-1", 101, 10_000),
      autoBidStepAmount: 1,
    });
    expect(result.isOk()).toBe(true);
    expect(bidRepo.create).toHaveBeenCalledTimes(2);
    expect(bidRepo.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ amount: "5001.00", placedByUserId: "buyer-high" }),
    );
  });
});

describe("BidService.placeBidWithIdempotency", () => {
  const strategyFactory = new LotStrategyFactory();

  it("replays cached payload when idempotency store returns a hit", async () => {
    const cachedBid = createBid({ id: "bid-replay" });
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(JSON.stringify({ data: cachedBid })),
      setWithExpiry: vi.fn(),
      tryClaim: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    };
    const lotRepo = baseLotRepo();
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifications = new NotificationService(
      { notifyBidPlaced: vi.fn() },
      { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
    );
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
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
    expect(idempotencyStore.tryClaim).not.toHaveBeenCalled();
  });

  it("claims idempotency key before placement and stores result", async () => {
    const created = createBid({ id: "bid-new" });
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(null),
      setWithExpiry: vi.fn(),
      tryClaim: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    };
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(lot({ currentPrice: "100.00" })),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn(),
    });
    const legalEntityRepository = {
      ensurePersonalEntity: vi.fn().mockResolvedValue({
        id: "buyer-le",
        displayName: "Buyer",
        kind: "individual",
        subkind: "private_collector",
        status: "approved",
        role: "owner",
        isPrimaryAdmin: true,
      }),
      findById: vi.fn().mockResolvedValue({
        id: "buyer-le",
        status: "approved",
      }),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      idempotencyStore,
      legalEntityRepository: legalEntityRepository as never,
    });
    const out = await service.placeBidWithIdempotency({
      placedByUserId: "u1",
      idempotencyKey: "k-new",
      lotId: "auc-1",
      amount: 150,
    });
    expect(out.type).toBe("ok");
    expect(idempotencyStore.tryClaim).toHaveBeenCalledWith(
      "idempotency:bid:u1:auc-1:k-new",
      expect.any(Number),
    );
    expect(idempotencyStore.setWithExpiry).toHaveBeenCalledOnce();
  });

  it("scopes idempotency keys per lot so the same key on different lots does not replay", async () => {
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(null),
      setWithExpiry: vi.fn(),
      tryClaim: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    };
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(lot({ currentPrice: "100.00" })),
    });
    const bidRepo = baseBidRepo({
      create: vi
        .fn()
        .mockResolvedValueOnce(createBid({ id: "bid-lot-a" }))
        .mockResolvedValueOnce(createBid({ id: "bid-lot-b" })),
      markWinningBid: vi.fn(),
    });
    const legalEntityRepository = {
      ensurePersonalEntity: vi.fn().mockResolvedValue({ id: "buyer-le", status: "approved" }),
      findById: vi.fn().mockResolvedValue({ id: "buyer-le", status: "approved" }),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      idempotencyStore,
      legalEntityRepository: legalEntityRepository as never,
    });

    await service.placeBidWithIdempotency({
      placedByUserId: "u1",
      idempotencyKey: "shared-key",
      lotId: "auc-1",
      amount: 150,
    });
    await service.placeBidWithIdempotency({
      placedByUserId: "u1",
      idempotencyKey: "shared-key",
      lotId: "auc-2",
      amount: 160,
    });

    expect(idempotencyStore.tryClaim).toHaveBeenCalledWith(
      "idempotency:bid:u1:auc-1:shared-key",
      expect.any(Number),
    );
    expect(idempotencyStore.tryClaim).toHaveBeenCalledWith(
      "idempotency:bid:u1:auc-2:shared-key",
      expect.any(Number),
    );
  });

  it("releases idempotency claim when placement fails", async () => {
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(null),
      setWithExpiry: vi.fn(),
      tryClaim: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    };
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(null),
    });
    const legalEntityRepository = {
      ensurePersonalEntity: vi.fn().mockResolvedValue({
        id: "buyer-le",
        displayName: "Buyer",
        kind: "individual",
        subkind: "private_collector",
        status: "approved",
        role: "owner",
        isPrimaryAdmin: true,
      }),
      findById: vi.fn().mockResolvedValue({
        id: "buyer-le",
        status: "approved",
      }),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, baseBidRepo()),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      idempotencyStore,
      legalEntityRepository: legalEntityRepository as never,
    });
    const out = await service.placeBidWithIdempotency({
      placedByUserId: "u1",
      idempotencyKey: "k-fail",
      lotId: "missing",
      amount: 100,
    });
    expect(out.type).toBe("err");
    expect(idempotencyStore.delete).toHaveBeenCalledOnce();
  });

  it("uses explicit buyerLegalEntityId without resolving personal entity", async () => {
    const orgEntityId = "org-le-agent";
    const created = createBid({ id: "bid-org", buyerLegalEntityId: orgEntityId });
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(null),
      setWithExpiry: vi.fn(),
      tryClaim: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    };
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(lot({ currentPrice: "100.00" })),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn(),
    });
    const ensurePersonalEntity = vi.fn();
    const legalEntityRepository = {
      ensurePersonalEntity,
      findById: vi.fn().mockResolvedValue({
        id: orgEntityId,
        status: "approved",
      }),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      idempotencyStore,
      legalEntityRepository: legalEntityRepository as never,
    });
    const out = await service.placeBidWithIdempotency({
      placedByUserId: "u1",
      buyerLegalEntityId: orgEntityId,
      idempotencyKey: "k-org",
      lotId: "auc-1",
      amount: 150,
    });
    expect(out.type).toBe("ok");
    expect(ensurePersonalEntity).not.toHaveBeenCalled();
    expect(legalEntityRepository.findById).toHaveBeenCalledWith(orgEntityId);
  });

  it("stores idempotency replay even when post-commit cache notify fails", async () => {
    const created = createBid({ id: "bid-cache-fail" });
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(null),
      setWithExpiry: vi.fn(),
      tryClaim: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    };
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(lot({ currentPrice: "100.00" })),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn(),
    });
    const legalEntityRepository = {
      ensurePersonalEntity: vi.fn().mockResolvedValue({ id: "buyer-le", status: "approved" }),
      findById: vi.fn().mockResolvedValue({ id: "buyer-le", status: "approved" }),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, bidRepo),
      strategyFactory,
      cache: {
        set: vi.fn().mockRejectedValue(new Error("redis down")),
        get: vi.fn(),
        del: vi.fn(),
      },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      idempotencyStore,
      legalEntityRepository: legalEntityRepository as never,
    });

    const out = await service.placeBidWithIdempotency({
      placedByUserId: "u1",
      idempotencyKey: "k-cache-fail",
      lotId: "auc-1",
      amount: 150,
    });

    expect(out.type).toBe("ok");
    expect(idempotencyStore.setWithExpiry).toHaveBeenCalledOnce();
    expect(idempotencyStore.delete).not.toHaveBeenCalled();
  });

  it("releases idempotency claim when placeBid throws (transaction rollback)", async () => {
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(null),
      setWithExpiry: vi.fn(),
      tryClaim: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    };
    const lotRepo = baseLotRepo({
      findByIdForUpdate: vi.fn().mockRejectedValue(new Error("connection reset")),
    });
    const legalEntityRepository = {
      ensurePersonalEntity: vi.fn().mockResolvedValue({ id: "buyer-le", status: "approved" }),
      findById: vi.fn().mockResolvedValue({ id: "buyer-le", status: "approved" }),
    };
    const service = new BidService({
      repos: createMockFactory(lotRepo, baseBidRepo()),
      strategyFactory,
      cache: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
      notifications: new NotificationService(
        { notifyBidPlaced: vi.fn() },
        { notifyLotExtended: vi.fn(), notifyLotEnded: vi.fn(), notifyProxyCancelled: vi.fn() },
      ),
      lotJobs: null,
      idempotencyStore,
      legalEntityRepository: legalEntityRepository as never,
    });

    await expect(
      service.placeBidWithIdempotency({
        placedByUserId: "u1",
        idempotencyKey: "k-throw",
        lotId: "auc-1",
        amount: 150,
      }),
    ).rejects.toThrow("connection reset");

    expect(idempotencyStore.delete).toHaveBeenCalledOnce();
  });
});
