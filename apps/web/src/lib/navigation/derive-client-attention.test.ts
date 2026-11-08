import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import type { AmountOwedEntry } from "@auction/domain";
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

const owed = (lotId: string, patch: Partial<AmountOwedEntry> = {}): AmountOwedEntry => ({
  lotId,
  state: "payment-due",
  role: "payer",
  amountDue: "1250.00",
  currency: "GBP",
  blocker: null,
  holder: null,
  ...patch,
});

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
      amountsOwed: [],
      stillToSend: [],
      unreadNotifications: [],
    });
    expect(attention.outbidLots).toEqual(["14", "22", null]);
    expect(attention.groups).toMatchObject([{ kind: "outbid", count: 3, url: "/bids?tab=active" }]);
  });

  it("names a single outbid lot and links straight to its price", () => {
    const attention = deriveClientAttention({
      userId: "user-1",
      bids: [bidOn({ lotId: "z", lotNumber: 3, winning: false, endsInHours: 2 })],
      amountsOwed: [],
      stillToSend: [],
      unreadNotifications: [],
    });
    expect(attention.groups).toMatchObject([
      { kind: "outbid", count: 1, url: "/lot/lot/z#price", items: [{ title: "Lot" }] },
    ]);
  });

  it("is in review only when everything owed waits on checks", () => {
    const inReview = (lotId: string) => owed(lotId, { state: "in-review", blocker: "review" });
    const derive = (amountsOwed: AmountOwedEntry[]) =>
      deriveClientAttention({
        userId: "user-1",
        bids: [],
        amountsOwed,
        stillToSend: [],
        unreadNotifications: [],
      });
    expect(derive([inReview("a"), inReview("b")])).toMatchObject({
      paymentsDue: 2,
      paymentsInReview: true,
    });
    expect(derive([inReview("a"), owed("b")])).toMatchObject({
      paymentsDue: 2,
      paymentsInReview: false,
    });
    expect(derive([])).toMatchObject({ paymentsDue: 0, paymentsInReview: false });
  });

  it("counts the purchases this person pays and unread notifications", () => {
    const attention = deriveClientAttention({
      userId: "user-1",
      bids: [],
      amountsOwed: [
        owed("a"),
        owed("b"),
        owed("c", { role: "informed" }),
        owed("d", { state: "cancelled" }),
      ],
      stillToSend: [],
      unreadNotifications: [{ read: false }, { read: true }, { read: false }],
    });
    expect(attention).toEqual({
      outbidLots: [],
      paymentsDue: 2,
      paymentsInReview: false,
      stillToSend: { count: 0, pence: 0, lotIds: [] },
      unreadNotifications: 2,
      groups: [],
    });
  });

  it("adds up what is still to send on a part-funded transfer, apart from what is due", () => {
    const attention = deriveClientAttention({
      userId: "user-1",
      bids: [],
      amountsOwed: [],
      stillToSend: [
        { lotId: "a", groupId: "g1", pence: 30_005 },
        { lotId: "b", groupId: "g1", pence: 20_000 },
      ],
      unreadNotifications: [],
    });
    expect(attention).toMatchObject({
      paymentsDue: 0,
      paymentsInReview: false,
      stillToSend: { count: 2, pence: 50_005, lotIds: ["a", "b"] },
    });
  });
});
