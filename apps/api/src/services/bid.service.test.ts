import type { Auction, Bid } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../lib/errors.js";
import { AuctionStrategyFactory } from "../strategies/strategy.factory.js";
import { BidService } from "./bid.service.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IAuctionRepository, IBidRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import { NotificationService } from "./notification.service.js";

function auction(overrides: Partial<Auction> = {}): Auction {
  const now = new Date();
  return {
    id: "auc-1",
    sellerId: "seller-1",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: null,
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createBid(partial: Partial<Bid> = {}): Bid {
  const now = new Date();
  return {
    id: "bid-1",
    auctionId: "auc-1",
    bidderId: "bidder-1",
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
    findHighestForAuction: vi.fn(),
    listForAuctionSettlement: vi.fn(),
    listForAuction: vi.fn().mockResolvedValue([]),
    listForBidder: vi.fn(),
    findWinningBid: vi.fn().mockResolvedValue(null),
    listDistinctBidderIds: vi.fn(),
    markWinningBid: vi.fn(),
    ...overrides,
  };
}

function baseAuctionRepo(overrides: Partial<IAuctionRepository> = {}): IAuctionRepository {
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
    findActiveDutchAuctions: vi.fn().mockResolvedValue([]),
    setDutchLastDecrementAt: vi.fn(),
    updateDutchCurrentPrice: vi.fn(),
    ...overrides,
  } as IAuctionRepository;
}

function createMockFactory(
  auctionRepo: IAuctionRepository,
  bidRepo: IBidRepository,
): IRepositoryFactory {
  const repos = { auction: auctionRepo, bid: bidRepo };
  return {
    root: repos,
    forConnection: () => repos,
    runInTransaction: async <T>(fn: (r: typeof repos) => Promise<T>) => fn(repos),
  };
}

describe("BidService.placeBid", () => {
  const strategyFactory = new AuctionStrategyFactory();

  it("returns Err when auction is not found", async () => {
    const auctionRepo = baseAuctionRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(null),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const bidNotif = { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) };
    const aucNotif = {
      notifyAuctionExtended: vi.fn().mockResolvedValue(undefined),
      notifyAuctionEnded: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, aucNotif);
    const service = new BidService(
      createMockFactory(auctionRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      null,
      null,
    );

    const result = await service.placeBid("bidder-1", "auc-1", 150);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(BidError);
      expect(result.error.message).toBe("Auction not found");
      expect(result.error.status).toBe(404);
    }
  });

  it("returns Err when auction is not active", async () => {
    const auctionRepo = baseAuctionRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(auction({ status: "ended" })),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const bidNotif = { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) };
    const aucNotif = {
      notifyAuctionExtended: vi.fn().mockResolvedValue(undefined),
      notifyAuctionEnded: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, aucNotif);
    const service = new BidService(
      createMockFactory(auctionRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      null,
      null,
    );

    const result = await service.placeBid("bidder-1", "auc-1", 150);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toBe("Auction is not accepting bids");
  });

  it("returns Err when bid fails strategy validation", async () => {
    const auctionRepo = baseAuctionRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(auction({ currentPrice: "200.00" })),
    });
    const bidRepo = baseBidRepo();
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const bidNotif = { notifyBidPlaced: vi.fn().mockResolvedValue(undefined) };
    const aucNotif = {
      notifyAuctionExtended: vi.fn().mockResolvedValue(undefined),
      notifyAuctionEnded: vi.fn().mockResolvedValue(undefined),
    };
    const notifications = new NotificationService(bidNotif, aucNotif);
    const service = new BidService(
      createMockFactory(auctionRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      null,
      null,
    );

    const result = await service.placeBid("bidder-1", "auc-1", 100);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toContain("Bid must be at least");
  });

  it("creates bid, updates cache, and notifies on success", async () => {
    const active = auction({ currentPrice: "100.00" });
    const created = createBid({ amount: "150.00" });

    const auctionRepo = baseAuctionRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cacheSet = vi.fn().mockResolvedValue(undefined);
    const cache: ICacheProvider = { set: cacheSet, get: vi.fn(), del: vi.fn() };
    const notifyBidPlaced = vi.fn().mockResolvedValue(undefined);
    const notifyAuctionExtended = vi.fn().mockResolvedValue(undefined);
    const notifyAuctionEnded = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced },
      { notifyAuctionExtended, notifyAuctionEnded },
    );
    const service = new BidService(
      createMockFactory(auctionRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      null,
      null,
    );

    const result = await service.placeBid("bidder-1", "auc-1", 150);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual(created);

    expect(bidRepo.create).toHaveBeenCalledOnce();
    expect(bidRepo.markWinningBid).toHaveBeenCalledWith("auc-1", "bid-1");
    expect(auctionRepo.updateCurrentPrice).toHaveBeenCalledWith("auc-1", "150.00");
    expect(cacheSet).toHaveBeenCalledWith("auction:auc-1:currentPrice", "150.00", 3600);
    expect(notifyBidPlaced).toHaveBeenCalledOnce();
    expect(notifyAuctionExtended).not.toHaveBeenCalled();
    expect(notifyAuctionEnded).not.toHaveBeenCalled();
  });

  it("ends Dutch auction on first acceptance and cancels lifecycle jobs", async () => {
    const now = new Date();
    const active = auction({
      auctionType: "dutch",
      currentPrice: "50.00",
      endTime: new Date(now.getTime() + 60 * 60_000),
    });
    const created = createBid({ amount: "50.00", bidderId: "buyer-1" });

    const auctionRepo = baseAuctionRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifyBidPlaced = vi.fn().mockResolvedValue(undefined);
    const notifyAuctionEnded = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced },
      { notifyAuctionExtended: vi.fn(), notifyAuctionEnded },
    );
    const cancelAuctionJobs = vi.fn().mockResolvedValue(undefined);
    const service = new BidService(
      createMockFactory(auctionRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      null,
      { rescheduleEnd: vi.fn(), cancelAuctionJobs },
    );

    const result = await service.placeBid("buyer-1", "auc-1", 50);
    expect(result.isOk()).toBe(true);
    expect(auctionRepo.setWinner).toHaveBeenCalledWith("auc-1", "buyer-1");
    expect(auctionRepo.updateStatus).toHaveBeenCalledWith("auc-1", "ended");
    expect(cancelAuctionJobs).toHaveBeenCalledWith("auc-1");
    expect(notifyAuctionEnded).toHaveBeenCalledOnce();
  });

  it("ends buy-it-now auction when bid meets buy-now price", async () => {
    const now = new Date();
    const active = auction({
      auctionType: "buy_it_now",
      currentPrice: "100.00",
      buyNowPrice: "500.00",
      endTime: new Date(now.getTime() + 60 * 60_000),
    });
    const created = createBid({ amount: "500.00", bidderId: "buyer-1" });

    const auctionRepo = baseAuctionRepo({
      findByIdForUpdate: vi.fn().mockResolvedValue(active),
    });
    const bidRepo = baseBidRepo({
      create: vi.fn().mockResolvedValue(created),
      markWinningBid: vi.fn().mockResolvedValue(undefined),
    });
    const cache: ICacheProvider = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
    const notifyBidPlaced = vi.fn().mockResolvedValue(undefined);
    const notifyAuctionEnded = vi.fn().mockResolvedValue(undefined);
    const notifications = new NotificationService(
      { notifyBidPlaced },
      { notifyAuctionExtended: vi.fn(), notifyAuctionEnded },
    );
    const cancelAuctionJobs = vi.fn().mockResolvedValue(undefined);
    const service = new BidService(
      createMockFactory(auctionRepo, bidRepo),
      strategyFactory,
      cache,
      notifications,
      null,
      { rescheduleEnd: vi.fn(), cancelAuctionJobs },
    );

    const result = await service.placeBid("buyer-1", "auc-1", 500);
    expect(result.isOk()).toBe(true);
    expect(auctionRepo.setWinner).toHaveBeenCalledWith("auc-1", "buyer-1");
    expect(auctionRepo.updateStatus).toHaveBeenCalledWith("auc-1", "ended");
    expect(cancelAuctionJobs).toHaveBeenCalledWith("auc-1");
    expect(notifyAuctionEnded).toHaveBeenCalledOnce();
  });
});
