import type { IBidRepository, ILotRepository } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type { Lot } from "@auction/types";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { AutoBidService } from "./auto-bid.service.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { IBidPlacer } from "./interfaces/place-bid.js";

const CAT = "c1000001-0000-4000-8000-000000000001";

function lot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "lot-1",
    saleId: null,
    lotNumber: 1,
    sellerId: "seller-1",
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
    minBidIncrement: "10.00",
    autoBidEnabled: true,
    autoBidStepMin: "10.00",
    autoBidStepMax: "50.00",
    autoBidStepPresets: [10, 20, 50],
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date(now.getTime() - 60_000),
    endTime: new Date(now.getTime() + 60 * 60_000),
    status: "active",
    winnerId: null,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

function repos(overrides: {
  lot?: Partial<ILotRepository>;
  bid?: Partial<IBidRepository>;
}): IRepositoryFactory {
  const lotRepo = {
    findById: vi.fn().mockResolvedValue(lot()),
    findByIdForUpdate: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    countMatching: vi.fn(),
    sumEndedHammer: vi.fn(),
    update: vi.fn(),
    updateCurrentPrice: vi.fn(),
    setWinner: vi.fn(),
    ...overrides.lot,
  } as unknown as ILotRepository;
  const bidRepo: IBidRepository = {
    create: vi.fn(),
    findHighestForLot: vi.fn(),
    listForLotSettlement: vi.fn(),
    findEligibleBidsForLotClose: vi.fn(),
    listForLot: vi.fn(),
    countForLot: vi.fn().mockResolvedValue(0),
    listForBidder: vi.fn(),
    findWinningBid: vi.fn().mockResolvedValue(null),
    listDistinctBidderIds: vi.fn(),
    markWinningBid: vi.fn(),
    clearWinningBid: vi.fn(),
    aggregateBidderCeilings: vi.fn(),
    listBidderCeilingStates: vi.fn(),
    updateProxySettingsForBidderOnLot: vi.fn(),
    findProxySettingsForBidderOnLot: vi.fn(),
    bidderHasProxyMaxOnLot: vi.fn(),
    clearProxyAutoBidForBidderOnLot: vi.fn(),
    listActiveProxyBidPairsForBuyerEntity: vi.fn(),
    listActiveProxyBidPairsForMemberOnEntity: vi.fn(),
    ...overrides.bid,
  };
  return {
    root: { lot: lotRepo, bid: bidRepo },
    forConnection: () => ({ lot: lotRepo, bid: bidRepo }),
    runInTransaction: async (
      fn: (repos: { lot: ILotRepository; bid: IBidRepository }, tx: unknown) => unknown,
    ) => fn({ lot: lotRepo, bid: bidRepo }, {}),
  } as unknown as IRepositoryFactory;
}

describe("AutoBidService", () => {
  it("returns null when user has no proxy settings", async () => {
    const service = new AutoBidService({
      repos: repos({ bid: { findProxySettingsForBidderOnLot: vi.fn().mockResolvedValue(null) } }),
      bidPlacer: { placeBid: vi.fn() },
      bidEligibility: null,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
    });
    const result = await service.getAutoBid({ lotId: "lot-1", placedByUserId: "u1" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeNull();
  });

  it("rejects invalid step against lot presets", async () => {
    const service = new AutoBidService({
      repos: repos({}),
      bidPlacer: { placeBid: vi.fn() },
      bidEligibility: null,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
    });
    const result = await service.setAutoBid({
      lotId: "lot-1",
      placedByUserId: "u1",
      buyerLegalEntityId: "u1",
      maxAutoBidAmount: 200,
      autoBidStepAmount: 15,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("auto_bid_step_invalid");
  });

  it("updates proxy settings when user is already winning", async () => {
    const updateProxy = vi.fn().mockResolvedValue(undefined);
    const findWinningBid = vi
      .fn()
      .mockResolvedValueOnce({
        id: "b1",
        placedByUserId: "u1",
        bidderId: "u1",
        amount: "110.00",
      })
      .mockResolvedValueOnce({
        id: "b1",
        placedByUserId: "u1",
        bidderId: "u1",
        amount: "110.00",
      });
    const service = new AutoBidService({
      repos: repos({
        lot: { findByIdForUpdate: vi.fn().mockResolvedValue(lot()) },
        bid: {
          findWinningBid,
          updateProxySettingsForBidderOnLot: updateProxy,
        },
      }),
      bidPlacer: { placeBid: vi.fn() },
      bidEligibility: {
        assertCanPlaceBid: vi.fn().mockResolvedValue(ok(undefined)),
      } as unknown as IBidEligibility,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
    });
    const result = await service.setAutoBid({
      lotId: "lot-1",
      placedByUserId: "u1",
      buyerLegalEntityId: "u1",
      maxAutoBidAmount: 300,
      autoBidStepAmount: 20,
    });
    expect(result.isOk()).toBe(true);
    expect(updateProxy).toHaveBeenCalledWith("lot-1", "u1", {
      maxAutoBidAmount: "300.00",
      autoBidStepAmount: "20.00",
    });
  });

  it("places opening bid when stale winner check shows user was outbid", async () => {
    const updateProxy = vi.fn();
    const placeBidWithIdempotency = vi.fn().mockResolvedValue({
      type: "ok",
      body: {
        data: {
          id: "b2",
          lotId: "lot-1",
          amount: "110.00",
          placedByUserId: "u1",
          isWinning: true,
          isAutoBid: true,
          maxAutoBidAmount: "200.00",
          autoBidStepAmount: "10.00",
          createdAt: new Date(),
        },
      },
    });
    const findWinningBid = vi
      .fn()
      .mockResolvedValueOnce({
        id: "b1",
        placedByUserId: "u1",
        bidderId: "u1",
        amount: "110.00",
      })
      .mockResolvedValueOnce({
        id: "b9",
        placedByUserId: "other",
        bidderId: "other",
        amount: "120.00",
      });
    const service = new AutoBidService({
      repos: repos({
        lot: { findByIdForUpdate: vi.fn().mockResolvedValue(lot()) },
        bid: {
          findWinningBid,
          updateProxySettingsForBidderOnLot: updateProxy,
        },
      }),
      bidPlacer: { placeBid: vi.fn() },
      bidPlacerWithIdempotency: {
        placeBid: vi.fn(),
        placeBidWithIdempotency,
      },
      bidEligibility: {
        assertCanPlaceBid: vi.fn().mockResolvedValue(ok(undefined)),
      } as unknown as IBidEligibility,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
    });
    const result = await service.setAutoBid({
      lotId: "lot-1",
      placedByUserId: "u1",
      buyerLegalEntityId: "u1",
      maxAutoBidAmount: 200,
      autoBidStepAmount: 10,
    });
    expect(result.isOk()).toBe(true);
    expect(updateProxy).not.toHaveBeenCalled();
    expect(placeBidWithIdempotency).toHaveBeenCalled();
  });

  it("places opening bid when user is not winning", async () => {
    const placeBid = vi.fn().mockResolvedValue(
      ok({
        id: "b2",
        lotId: "lot-1",
        amount: "110.00",
        bidderId: "u1",
        placedByUserId: "u1",
        isWinning: true,
        isAutoBid: true,
        maxAutoBidAmount: "200.00",
        autoBidStepAmount: "10.00",
        createdAt: new Date(),
      }),
    );
    const service = new AutoBidService({
      repos: repos({}),
      bidPlacer: { placeBid } as IBidPlacer,
      bidEligibility: {
        assertCanPlaceBid: vi.fn().mockResolvedValue(ok(undefined)),
      } as unknown as IBidEligibility,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
    });
    const result = await service.setAutoBid({
      lotId: "lot-1",
      placedByUserId: "u1",
      buyerLegalEntityId: "u1",
      maxAutoBidAmount: 200,
      autoBidStepAmount: 10,
    });
    expect(result.isOk()).toBe(true);
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({
        lotId: "lot-1",
        amount: 110,
        maxAutoBidAmount: 200,
        autoBidStepAmount: 10,
      }),
    );
  });

  it("clearAutoBid clears proxy rows", async () => {
    const clear = vi.fn().mockResolvedValue(1);
    const notifyProxyCancelled = vi.fn().mockResolvedValue(undefined);
    const service = new AutoBidService({
      repos: repos({ bid: { clearProxyAutoBidForBidderOnLot: clear } }),
      bidPlacer: { placeBid: vi.fn() },
      bidEligibility: null,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
      notifications: { notifyProxyCancelled } as never,
    });
    const result = await service.clearAutoBid({ lotId: "lot-1", placedByUserId: "u1" });
    expect(result.isOk()).toBe(true);
    expect(clear).toHaveBeenCalledWith("lot-1", "u1");
    expect(notifyProxyCancelled).toHaveBeenCalledWith("lot-1", "u1", "user_cleared");
  });

  it("rejects when lot auto-bid disabled", async () => {
    const service = new AutoBidService({
      repos: repos({
        lot: { findById: vi.fn().mockResolvedValue(lot({ autoBidEnabled: false })) },
      }),
      bidPlacer: { placeBid: vi.fn() },
      bidEligibility: null,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
    });
    const result = await service.setAutoBid({
      lotId: "lot-1",
      placedByUserId: "u1",
      buyerLegalEntityId: "u1",
      maxAutoBidAmount: 200,
      autoBidStepAmount: 10,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("auto_bid_disabled");
  });

  it("accepts max auto-bid exactly equal to next minimum bid", async () => {
    const placeBid = vi.fn().mockResolvedValue(
      ok({
        id: "b2",
        lotId: "lot-1",
        amount: "110.00",
        bidderId: "u1",
        placedByUserId: "u1",
        isWinning: true,
        isAutoBid: true,
        maxAutoBidAmount: "110.00",
        autoBidStepAmount: "10.00",
        createdAt: new Date(),
      }),
    );
    const service = new AutoBidService({
      repos: repos({}),
      bidPlacer: { placeBid } as IBidPlacer,
      bidEligibility: {
        assertCanPlaceBid: vi.fn().mockResolvedValue(ok(undefined)),
      } as unknown as IBidEligibility,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
    });
    const result = await service.setAutoBid({
      lotId: "lot-1",
      placedByUserId: "u1",
      buyerLegalEntityId: "u1",
      maxAutoBidAmount: 110,
      autoBidStepAmount: 10,
    });
    expect(result.isOk()).toBe(true);
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 110,
        maxAutoBidAmount: 110,
      }),
    );
  });

  it("rejects max auto-bid one cent below next minimum bid", async () => {
    const placeBid = vi.fn();
    const service = new AutoBidService({
      repos: repos({}),
      bidPlacer: { placeBid } as IBidPlacer,
      bidEligibility: null,
      legalEntityRepository: { ensurePersonalEntity: vi.fn() } as never,
    });
    const result = await service.setAutoBid({
      lotId: "lot-1",
      placedByUserId: "u1",
      buyerLegalEntityId: "u1",
      maxAutoBidAmount: 109.99,
      autoBidStepAmount: 10,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("110.00");
    expect(placeBid).not.toHaveBeenCalled();
  });
});
