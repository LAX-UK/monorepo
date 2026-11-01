import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { describe, expect, it } from "vitest";
import { deriveClientAttention } from "./derive-client-attention";

const NOW = Date.parse("2026-06-01T12:00:00.000Z");

function bidOn(opts: {
  lotId: string;
  lotNumber: number | null;
  winning: boolean;
  endsInHours: number;
}): BidWithLot {
  const start = new Date("2026-06-01T09:00:00.000Z");
  return {
    bid: {
      id: `bid-${opts.lotId}`,
      lotId: opts.lotId,
      amount: "500",
      isWinning: opts.winning,
      isAutoBid: false,
      maxAutoBidAmount: null,
      placedByUserId: "user-1",
      createdAt: start,
    },
    lot: {
      id: opts.lotId,
      saleId: null,
      lotNumber: opts.lotNumber,
      sellerLegalEntityId: "seller-1",
      title: "Lot",
      description: null,
      medium: null,
      dimensions: null,
      images: [],
      categoryId: "",
      auctionType: "english",
      startingPrice: "100",
      reservePrice: null,
      buyNowPrice: null,
      currentPrice: opts.winning ? "500" : "700",
      buyerPremiumRate: "0.25",
      minBidIncrement: "50",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: start,
      endTime: new Date(NOW + opts.endsInHours * 3_600_000),
      status: "active",
      winnerId: null,
      marketingDetails: {},
      createdAt: start,
      updatedAt: start,
    },
  };
}

describe("deriveClientAttention", () => {
  it("lists outbid lots soonest to close first, by catalogue number", () => {
    const attention = deriveClientAttention({
      userId: "user-1",
      bids: [
        bidOn({ lotId: "a", lotNumber: 22, winning: false, endsInHours: 5 }),
        bidOn({ lotId: "b", lotNumber: 14, winning: false, endsInHours: 1 }),
        bidOn({ lotId: "c", lotNumber: 8, winning: true, endsInHours: 2 }),
        bidOn({ lotId: "d", lotNumber: null, winning: false, endsInHours: 9 }),
      ],
      purchasesToPay: [],
      unreadNotifications: [],
    });
    expect(attention.outbidLots).toEqual(["14", "22", null]);
    expect(attention.groups).toMatchObject([{ kind: "outbid", count: 3, url: "/bids?tab=active" }]);
  });

  it("names a single outbid lot and links straight to its price", () => {
    const attention = deriveClientAttention({
      userId: "user-1",
      bids: [bidOn({ lotId: "z", lotNumber: 3, winning: false, endsInHours: 2 })],
      purchasesToPay: [],
      unreadNotifications: [],
    });
    expect(attention.groups).toMatchObject([
      { kind: "outbid", count: 1, url: "/lot/lot/z#price", items: [{ title: "Lot" }] },
    ]);
  });

  it("counts the purchases this person pays and unread notifications", () => {
    const attention = deriveClientAttention({
      userId: "user-1",
      bids: [],
      purchasesToPay: [{ lot: "a" }, { lot: "b" }],
      unreadNotifications: [{ read: false }, { read: true }, { read: false }],
    });
    expect(attention).toEqual({
      outbidLots: [],
      paymentsDue: 2,
      unreadNotifications: 2,
      groups: [],
    });
  });
});
