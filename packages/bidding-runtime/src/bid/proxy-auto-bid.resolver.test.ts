import type { Database } from "@auction/db";
import type { IAntiShillingGuard, IBidRepository } from "@auction/persistence/interfaces";
import type { Bid, Lot } from "@auction/types";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../bid-error.js";
import type { INotificationSender } from "../ports.js";
import { ProxyAutoBidResolver } from "./proxy-auto-bid.resolver.js";
import type { IStandingBidEligibilityValidator } from "./standing-bid-eligibility.validator.js";

const CAT = "c1000001-0000-4000-8000-000000000001";

function mkLot(): Lot {
  const now = new Date();
  return {
    id: "lot-1",
    saleId: null,
    lotNumber: null,
    sellerId: "seller-1",
    sellerLegalEntityId: "seller-le",
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
    autoBidStepMin: null,
    autoBidStepMax: null,
    autoBidStepPresets: null,
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: new Date(now.getTime() + 86_400_000),
    status: "active",
    winnerId: null,
    voidedReason: null,
    archivedSeller: false,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
  };
}

function mkBid(partial: Partial<Bid> = {}): Bid {
  const now = new Date();
  return {
    id: "bid-manual",
    lotId: "lot-1",
    bidderId: "bidder-b",
    placedByUserId: "bidder-b",
    buyerLegalEntityId: "le-b",
    amount: "120.00",
    isWinning: false,
    isAutoBid: false,
    maxAutoBidAmount: "300.00",
    autoBidStepAmount: "10.00",
    createdAt: now,
    ...partial,
  };
}

describe("ProxyAutoBidResolver.resolve", () => {
  it("logs proxy cancellation notification failures without aborting", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const notifyProxyCancelled = vi.fn().mockRejectedValue(new Error("push unavailable"));
    const notifications = { notifyProxyCancelled } as unknown as INotificationSender;
    const resolver = new ProxyAutoBidResolver(null, notifications, null);

    await (
      resolver as unknown as {
        notifyProxyCancelledSafe: (
          lotId: string,
          bidderUserId: string,
          reason: string,
        ) => Promise<void>;
      }
    ).notifyProxyCancelledSafe("lot-1", "bidder-1", "anti_shilling_violation");

    expect(notifyProxyCancelled).toHaveBeenCalledWith(
      "lot-1",
      "bidder-1",
      "anti_shilling_violation",
    );
    errorSpy.mockRestore();
  });

  it("settles proxy war at runner-up ceiling plus winner step", async () => {
    const t1 = new Date("2026-01-01T10:00:00Z");
    const t2 = new Date("2026-01-01T10:01:00Z");
    const create = vi.fn().mockImplementation(async (row) => ({
      ...mkBid({ id: "proxy-settle", amount: row.amount, isAutoBid: true }),
      ...row,
    }));
    const bids = {
      listBidderCeilingStates: vi.fn().mockResolvedValue([
        {
          bidderId: "bidder-a",
          buyerLegalEntityId: "le-a",
          ceiling: "500.00",
          autoBidStepAmount: "10.00",
          maxCreatedAt: t2,
        },
        {
          bidderId: "bidder-b",
          buyerLegalEntityId: "le-b",
          ceiling: "300.00",
          autoBidStepAmount: "10.00",
          maxCreatedAt: t1,
        },
      ]),
      create,
    } as unknown as IBidRepository;

    const resolver = new ProxyAutoBidResolver(null, {} as INotificationSender, null);
    const result = await resolver.resolve(
      bids,
      "lot-1",
      mkLot(),
      mkBid({ amount: "120.00" }),
      {} as Database,
      [],
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        placedByUserId: "bidder-a",
        amount: "310.00",
        isAutoBid: true,
      }),
    );
    expect(result.amount).toBe("310.00");
  });

  it("tie-breaks equal ceilings by earliest proxy registration", async () => {
    const earlier = new Date("2026-01-01T09:00:00Z");
    const later = new Date("2026-01-01T10:00:00Z");
    const create = vi.fn().mockImplementation(async (row) => ({
      ...mkBid({ id: "proxy-tie", amount: row.amount }),
      ...row,
    }));
    const bids = {
      listBidderCeilingStates: vi.fn().mockResolvedValue([
        {
          bidderId: "bidder-late",
          buyerLegalEntityId: "le-late",
          ceiling: "400.00",
          autoBidStepAmount: "10.00",
          maxCreatedAt: later,
        },
        {
          bidderId: "bidder-early",
          buyerLegalEntityId: "le-early",
          ceiling: "400.00",
          autoBidStepAmount: "10.00",
          maxCreatedAt: earlier,
        },
      ]),
      create,
    } as unknown as IBidRepository;

    const resolver = new ProxyAutoBidResolver(null, {} as INotificationSender, null);
    await resolver.resolve(bids, "lot-1", mkLot(), mkBid({ amount: "120.00" }), {} as Database, []);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ placedByUserId: "bidder-early", amount: "400.00" }),
    );
  });

  it("clears proxy for anti-shilling violators", async () => {
    const guard: IAntiShillingGuard = {
      violatesAntiShilling: vi.fn().mockResolvedValue(true),
      bidderSharesSellerLegalEntity: vi.fn().mockResolvedValue(false),
    };
    const clearProxyAutoBidForBidderOnLot = vi.fn().mockResolvedValue(1);
    const notifyProxyCancelled = vi.fn().mockResolvedValue(undefined);
    const bids = {
      listBidderCeilingStates: vi.fn().mockResolvedValue([
        {
          bidderId: "shill",
          buyerLegalEntityId: "le-shill",
          ceiling: "900.00",
          autoBidStepAmount: "10.00",
          maxCreatedAt: new Date(),
        },
      ]),
      bidderHasProxyMaxOnLot: vi.fn().mockResolvedValue(true),
      clearProxyAutoBidForBidderOnLot,
      create: vi.fn(),
    } as unknown as IBidRepository;

    const resolver = new ProxyAutoBidResolver(
      guard,
      { notifyProxyCancelled } as unknown as INotificationSender,
      null,
    );
    const pending: import("./proxy-auto-bid.resolver.js").ProxyCancelNotification[] = [];
    await resolver.cancelViolatingProxyBids("lot-1", mkLot(), bids, {} as Database, pending);
    await resolver.flushPendingProxyCancels(pending);
    expect(clearProxyAutoBidForBidderOnLot).toHaveBeenCalledWith("lot-1", "shill");
    expect(notifyProxyCancelled).toHaveBeenCalledWith("lot-1", "shill", "anti_shilling_violation");
  });

  it("cancels standing proxies that lost email or KYC eligibility when revalidation runs", async () => {
    const clearProxyAutoBidForBidderOnLot = vi.fn().mockResolvedValue(1);
    const bids = {
      listBidderCeilingStates: vi.fn().mockResolvedValue([
        {
          bidderId: "lost-kyc",
          buyerLegalEntityId: "le-1",
          ceiling: "400.00",
          autoBidStepAmount: "10.00",
          maxCreatedAt: new Date(),
        },
      ]),
      bidderHasProxyMaxOnLot: vi.fn().mockResolvedValue(true),
      clearProxyAutoBidForBidderOnLot,
    } as unknown as IBidRepository;
    const standingBidValidator: IStandingBidEligibilityValidator = {
      validate: vi
        .fn()
        .mockResolvedValue(
          err(new BidError("Identity verification required", 403, "kyc_required")),
        ),
    };
    const resolver = new ProxyAutoBidResolver(
      null,
      {} as INotificationSender,
      null,
      standingBidValidator,
    );
    const pending: import("./proxy-auto-bid.resolver.js").ProxyCancelNotification[] = [];

    await resolver.cancelViolatingProxyBids("lot-1", mkLot(), bids, {} as Database, pending);

    expect(clearProxyAutoBidForBidderOnLot).toHaveBeenCalledWith("lot-1", "lost-kyc");
    expect(pending).toContainEqual({
      lotId: "lot-1",
      bidderUserId: "lost-kyc",
      reason: "kyc_required",
    });
  });

  it("aborts without cancelling standing proxies when eligibility revalidation is transient", async () => {
    const clearProxyAutoBidForBidderOnLot = vi.fn().mockResolvedValue(1);
    const bids = {
      listBidderCeilingStates: vi.fn().mockResolvedValue([
        {
          bidderId: "still-eligible",
          buyerLegalEntityId: "le-1",
          ceiling: "400.00",
          autoBidStepAmount: "10.00",
          maxCreatedAt: new Date(),
        },
      ]),
      bidderHasProxyMaxOnLot: vi.fn().mockResolvedValue(true),
      clearProxyAutoBidForBidderOnLot,
    } as unknown as IBidRepository;
    const standingBidValidator: IStandingBidEligibilityValidator = {
      validate: vi
        .fn()
        .mockResolvedValue(
          err(
            new BidError(
              "Standing bid eligibility could not be revalidated",
              503,
              "standing_bid_revalidation_failed",
            ),
          ),
        ),
    };
    const resolver = new ProxyAutoBidResolver(
      null,
      {} as INotificationSender,
      null,
      standingBidValidator,
    );
    const pending: import("./proxy-auto-bid.resolver.js").ProxyCancelNotification[] = [];

    await expect(
      resolver.cancelViolatingProxyBids("lot-1", mkLot(), bids, {} as Database, pending),
    ).rejects.toMatchObject({
      code: "standing_bid_revalidation_failed",
      status: 503,
    });
    expect(clearProxyAutoBidForBidderOnLot).not.toHaveBeenCalled();
    expect(pending).toEqual([]);
  });

  it.each([
    "entity_not_authorised_to_bid",
    "membership_required",
    "buyer_agent_authorisation_required",
  ])(
    "cancels a standing ceiling with %s without aborting proxy settlement",
    async (failureCode) => {
      const clearProxyAutoBidForBidderOnLot = vi.fn().mockResolvedValue(1);
      const create = vi.fn().mockImplementation(async (row) => ({
        ...mkBid({ id: "eligible-settle", amount: row.amount }),
        ...row,
      }));
      const bids = {
        listBidderCeilingStates: vi.fn().mockResolvedValue([
          {
            bidderId: "ineligible",
            buyerLegalEntityId: "le-ineligible",
            ceiling: "900.00",
            autoBidStepAmount: "10.00",
            maxCreatedAt: new Date("2026-01-01T09:00:00Z"),
          },
          {
            bidderId: "eligible",
            buyerLegalEntityId: "le-eligible",
            ceiling: "300.00",
            autoBidStepAmount: "10.00",
            maxCreatedAt: new Date("2026-01-01T10:00:00Z"),
          },
        ]),
        bidderHasProxyMaxOnLot: vi.fn().mockResolvedValue(true),
        clearProxyAutoBidForBidderOnLot,
        create,
      } as unknown as IBidRepository;
      const standingBidValidator: IStandingBidEligibilityValidator = {
        validate: vi.fn(async (_lotId, state) =>
          state.bidderId === "ineligible"
            ? err(new BidError("Standing bid no longer eligible", 403, failureCode))
            : ok(undefined),
        ),
      };
      const resolver = new ProxyAutoBidResolver(
        null,
        {} as INotificationSender,
        null,
        standingBidValidator,
      );
      const pending: import("./proxy-auto-bid.resolver.js").ProxyCancelNotification[] = [];

      await resolver.resolve(
        bids,
        "lot-1",
        mkLot(),
        mkBid({ amount: "120.00" }),
        {} as Database,
        pending,
      );

      expect(clearProxyAutoBidForBidderOnLot).toHaveBeenCalledWith("lot-1", "ineligible");
      expect(pending).toContainEqual({
        lotId: "lot-1",
        bidderUserId: "ineligible",
        reason: failureCode,
      });
      expect(create).not.toHaveBeenCalledWith(
        expect.objectContaining({ placedByUserId: "ineligible" }),
      );
    },
  );
});
