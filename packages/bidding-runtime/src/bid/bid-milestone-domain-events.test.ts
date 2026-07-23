import type { Bid } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { publishBidMilestoneDomainEvents } from "./bid-milestone-domain-events.js";

const tx = {} as never;

function mockDomainEventSink(publish = vi.fn().mockResolvedValue(undefined)) {
  return {
    publish,
    withTx: vi.fn().mockReturnValue({ publish }),
  };
}

function bid(overrides: Partial<Bid> & Pick<Bid, "id">): Bid {
  return {
    id: overrides.id,
    lotId: overrides.lotId ?? "lot-1",
    placedByUserId: overrides.placedByUserId ?? "bidder-a",
    bidderId: overrides.bidderId ?? overrides.placedByUserId ?? "bidder-a",
    buyerLegalEntityId: overrides.buyerLegalEntityId ?? "le-a",
    amount: overrides.amount ?? "100.00",
    isWinning: overrides.isWinning ?? false,
    isAutoBid: overrides.isAutoBid ?? false,
    maxAutoBidAmount: overrides.maxAutoBidAmount ?? null,
    autoBidStepAmount: overrides.autoBidStepAmount ?? null,
    placedVia: overrides.placedVia ?? null,
    telephoneBookingId: overrides.telephoneBookingId ?? null,
    clerkUserId: overrides.clerkUserId ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("publishBidMilestoneDomainEvents", () => {
  it("no-ops without domainEventSink", async () => {
    await publishBidMilestoneDomainEvents(null, tx, {
      lotId: "lot-1",
      winningBid: bid({ id: "b1" }),
      prevWinnerId: null,
      prevWinningBid: null,
      isFirstBidForUserOnLot: true,
    });
  });

  it("publishes first_for_user and outbid in the same tx sink", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const sink = mockDomainEventSink(publish);

    await publishBidMilestoneDomainEvents(sink, tx, {
      lotId: "lot-1",
      winningBid: bid({ id: "b-new", placedByUserId: "bidder-new", amount: "150.00" }),
      prevWinnerId: "bidder-prev",
      prevWinningBid: bid({ id: "b-prev", placedByUserId: "bidder-prev", amount: "125.00" }),
      isFirstBidForUserOnLot: true,
    });

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventType: "bid.first_for_user",
        aggregateId: "b-new",
        payload: expect.objectContaining({
          bidId: "b-new",
          lotId: "lot-1",
          userId: "bidder-new",
          amountCents: 15_000,
        }),
      }),
    );
    expect(publish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: "bid.outbid",
        aggregateId: "b-prev",
        payload: expect.objectContaining({
          previousBidId: "b-prev",
          displacedBidId: "b-prev",
          userId: "bidder-prev",
          newHighAmountCents: 15_000,
        }),
      }),
    );
  });

  it("skips outbid when the same user remains high bidder", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const sink = mockDomainEventSink(publish);

    await publishBidMilestoneDomainEvents(sink, tx, {
      lotId: "lot-1",
      winningBid: bid({ id: "b2", placedByUserId: "bidder-a", amount: "200.00" }),
      prevWinnerId: "bidder-a",
      prevWinningBid: bid({ id: "b1", placedByUserId: "bidder-a" }),
      isFirstBidForUserOnLot: false,
    });

    expect(publish).not.toHaveBeenCalled();
  });
});
