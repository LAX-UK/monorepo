import { LaxMoneyEntryV1, LaxPortfolioItemV1 } from "@auction/lax-ecosystem";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  facts,
  payment,
  payout,
  sellerLot,
  submission,
  wonLot,
} from "../../testing/bid-portfolio-facts.js";
import {
  type BidPortfolioContext,
  buildBidMoneyEntries,
  buildBidPortfolioItems,
} from "./bid-portfolio.adapter.js";

const ctx: BidPortfolioContext = {
  webOrigin: "https://lax.bid",
  legalName: "London Auction Xchange LTD",
  imageUrl: (key) => (key ? `https://cdn.lax.bid/${key}` : null),
};

const WON_LOT_ID = "11111111-1111-4111-8111-111111111111";

function itemsFor(overrides: Parameters<typeof facts>[0]) {
  const items = buildBidPortfolioItems(facts(overrides), ctx);
  for (const item of items) expect(Value.Check(LaxPortfolioItemV1, item)).toBe(true);
  return items;
}

function entriesFor(overrides: Parameters<typeof facts>[0]) {
  const entries = buildBidMoneyEntries(facts(overrides), ctx);
  for (const entry of entries) expect(Value.Check(LaxMoneyEntryV1, entry)).toBe(true);
  return entries;
}

describe("buildBidPortfolioItems: wins", () => {
  it("splits a paid win into hammer and buyer's premium in the payment currency", () => {
    const [item] = itemsFor({ wonLots: [wonLot()], payments: [payment()] });
    expect(item).toMatchObject({
      product: "bid",
      id: WON_LOT_ID,
      artist: "Ada Artist",
      image: "https://cdn.lax.bid/lots/blue-study.jpg",
      acquiredAt: "2026-03-01T10:00:00.000Z",
      status: "owned",
      business: { key: "lax_bid", legalName: "London Auction Xchange LTD" },
    });
    expect(item?.paid.lines).toEqual([
      { kind: "hammer", amount: 100_000, currency: "GBP" },
      { kind: "premium", amount: 25_000, currency: "GBP" },
    ]);
  });

  it("keeps the hammer line when the stored settlement amount is zero or unreadable", () => {
    for (const amount of ["0.00", "not-a-number"]) {
      const [item] = itemsFor({ wonLots: [wonLot()], payments: [payment({ amount })] });
      expect(item?.paid.lines).toEqual([{ kind: "hammer", amount: 100_000, currency: "GBP" }]);
    }
  });

  it("emits no cost lines rather than an invalid one when the hammer is unreadable", () => {
    const [item] = itemsFor({ wonLots: [wonLot({ hammerPrice: "n/a" })], payments: [payment()] });
    expect(item?.paid.lines).toEqual([]);
  });

  it("omits the premium line when the settlement equals the hammer", () => {
    const [item] = itemsFor({ wonLots: [wonLot()], payments: [payment({ amount: "1000.00" })] });
    expect(item?.paid.lines).toEqual([{ kind: "hammer", amount: 100_000, currency: "GBP" }]);
  });

  it("offers payment for a win that has no payment yet, still showing the hammer from the lot", () => {
    const [item] = itemsFor({ wonLots: [wonLot()] });
    expect(item?.status).toBe("awaiting_payment");
    expect(item?.paid.lines).toEqual([{ kind: "hammer", amount: 100_000, currency: "GBP" }]);
    expect(item?.actions[0]).toEqual({
      kind: "pay",
      href: `https://lax.bid/purchases/checkout/${WON_LOT_ID}`,
    });
    expect(item?.documents).toEqual([
      expect.objectContaining({ kind: "invoice", available: false }),
    ]);
  });

  it.each(["pending", "authorized", "requires_manual_review"] as const)(
    "treats a %s payment as awaiting payment",
    (status) => {
      const [item] = itemsFor({ wonLots: [wonLot()], payments: [payment({ status })] });
      expect(item?.status).toBe("awaiting_payment");
      expect(item?.actions.map((a) => a.kind)).toContain("pay");
    },
  );

  it.each([
    ["awaiting_release", "awaiting_shipment"],
    ["released", "awaiting_shipment"],
    ["ready_for_collection", "awaiting_shipment"],
    ["in_transit", "awaiting_shipment"],
    ["delivered", "owned"],
    ["cancelled", "owned"],
    [null, "owned"],
  ] as const)("maps fulfilment %s on a paid win to %s", (fulfilmentStatus, expected) => {
    const [item] = itemsFor({ wonLots: [wonLot({ fulfilmentStatus })], payments: [payment()] });
    expect(item?.status).toBe(expected);
  });

  it("links the invoice and offers to consign once the work is owned", () => {
    const [item] = itemsFor({ wonLots: [wonLot()], payments: [payment()] });
    expect(item?.documents).toEqual([
      { kind: "invoice", available: true, href: "https://lax.bid/purchases#payment-history" },
    ]);
    expect(item?.actions.map((a) => a.kind)).toEqual(["consign", "view"]);
  });

  it("uses the newest payment when a lot has several", () => {
    const [item] = itemsFor({
      wonLots: [wonLot()],
      payments: [
        payment({ id: "b", status: "pending", createdAt: new Date("2026-03-05T00:00:00.000Z") }),
        payment({ id: "a", status: "cancelled", createdAt: new Date("2026-03-02T00:00:00.000Z") }),
      ],
    });
    expect(item?.status).toBe("awaiting_payment");
  });

  it.each(["refunded", "cancelled"] as const)(
    "leaves a %s purchase out of the holdings",
    (status) => {
      expect(itemsFor({ wonLots: [wonLot()], payments: [payment({ status })] })).toEqual([]);
    },
  );

  it("gives a work with no artist an empty artist rather than a placeholder", () => {
    const [item] = itemsFor({ wonLots: [wonLot({ artistName: null })], payments: [payment()] });
    expect(item?.artist).toBe("");
  });
});

describe("buildBidPortfolioItems: consigned and selling", () => {
  it("lists a pending consignment as consigned with a link to the submission", () => {
    const [item] = itemsFor({ submissions: [submission()] });
    expect(item).toMatchObject({
      status: "consigned",
      acquiredAt: "2026-02-01T08:00:00.000Z",
      actions: [
        {
          kind: "view",
          href: "https://lax.bid/selling/consignments/33333333-3333-4333-8333-333333333333",
        },
      ],
    });
  });

  it("lists a lot in a sale as in_sale", () => {
    const [item] = itemsFor({ sellerLots: [sellerLot()] });
    expect(item?.status).toBe("in_sale");
    expect(item?.actions[0]?.href).toMatch(/^https:\/\/lax\.bid\/lot\/green-line\/4444/);
  });

  it.each([
    [{ buyerPaid: false, payoutStatus: null }, "sold"],
    [{ buyerPaid: true, payoutStatus: null }, "payout_pending"],
    [{ buyerPaid: true, payoutStatus: "scheduled" }, "payout_pending"],
    [{ buyerPaid: true, payoutStatus: "in_transit" }, "payout_pending"],
    [{ buyerPaid: true, payoutStatus: "failed" }, "payout_pending"],
    [{ buyerPaid: true, payoutStatus: "reversed" }, "payout_pending"],
    [{ buyerPaid: true, payoutStatus: "paid" }, "payout_paid"],
  ] as const)("maps a closed sale %o to %s", (state, expected) => {
    const [item] = itemsFor({ sellerLots: [sellerLot({ stage: "sold", ...state })] });
    expect(item?.status).toBe(expected);
  });

  it("attaches the payout statement when the payout has one", () => {
    const [item] = itemsFor({
      sellerLots: [
        sellerLot({
          stage: "sold",
          buyerPaid: true,
          payoutStatus: "paid",
          payoutHasStatement: true,
        }),
      ],
    });
    expect(item?.documents).toEqual([
      {
        kind: "payout_statement",
        available: true,
        href: "https://lax.bid/selling/payouts",
      },
    ]);
  });
});

describe("buildBidMoneyEntries", () => {
  it("reports an unpaid win as owed by you", () => {
    expect(entriesFor({ payments: [payment({ status: "pending" })] })).toEqual([
      expect.objectContaining({
        id: "payment:22222222-2222-4222-8222-222222222222",
        direction: "owed_by_you",
        status: "pending",
        amount: 125_000,
        currency: "GBP",
        href: "https://lax.bid/purchases#payment-history",
        business: { key: "lax_bid", legalName: "London Auction Xchange LTD" },
      }),
    ]);
  });

  it("reports a captured payment as paid", () => {
    expect(entriesFor({ payments: [payment()] })).toEqual([
      expect.objectContaining({ direction: "paid", status: "completed", amount: 125_000 }),
    ]);
  });

  it("reports a refunded payment as both paid and refunded", () => {
    const entries = entriesFor({ payments: [payment({ status: "refunded" })] });
    expect(entries.map((e) => [e.id.split(":").slice(2).join(":"), e.direction])).toEqual([
      ["", "paid"],
      ["refund", "refunded"],
    ]);
  });

  it("keeps a cancelled invoice in the ledger as cancelled, not as owed", () => {
    expect(entriesFor({ payments: [payment({ status: "cancelled" })] })).toEqual([
      expect.objectContaining({ direction: "owed_by_you", status: "cancelled" }),
    ]);
  });

  it("reports a paid payout as received money plus the fees taken", () => {
    const entries = entriesFor({ payouts: [payout()] });
    expect(entries.map((e) => [e.direction, e.status, e.amount])).toEqual([
      ["owed_to_you", "completed", 90_000],
      ["fee", "completed", 7_500],
      ["fee", "completed", 2_500],
    ]);
    expect(entries[0]?.occurredAt).toBe("2026-04-03T12:00:00.000Z");
    expect(entries[0]?.href).toBe("https://lax.bid/selling/payouts");
  });

  it("reports a scheduled payout as pending, dated by its period end", () => {
    const [owed] = entriesFor({
      payouts: [payout({ status: "scheduled", processedAt: null, platformFee: "0.00" })],
    });
    expect(owed).toMatchObject({
      direction: "owed_to_you",
      status: "pending",
      occurredAt: "2026-04-01T00:00:00.000Z",
    });
  });

  it("drops zero-value fee lines and cancels the entries of a reversed payout", () => {
    const entries = entriesFor({
      payouts: [payout({ status: "reversed", platformFee: "0.00", stripeFee: "0.00" })],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe("cancelled");
  });

  it("keeps each currency on its own entry and never converts", () => {
    const entries = entriesFor({
      payments: [payment()],
      payouts: [payout({ currency: "EUR", platformFee: "0.00", stripeFee: "0.00" })],
    });
    expect(entries.map((e) => [e.direction, e.currency, e.amount])).toEqual([
      ["paid", "GBP", 125_000],
      ["owed_to_you", "EUR", 90_000],
    ]);
  });

  it("is empty when the person has no money movements", () => {
    expect(entriesFor({})).toEqual([]);
  });
});

describe("buildBidMoneyEntries: contract validity", () => {
  const PAYOUT_STATUSES = [
    "scheduled",
    "in_transit",
    "paid",
    "failed",
    "reversed",
    "clawback_pending",
  ] as const;

  it.each(PAYOUT_STATUSES)(
    "emits only valid entries for a %s payout with a positive net",
    (status) => {
      expect(entriesFor({ payouts: [payout({ status })] }).length).toBeGreaterThan(0);
    },
  );

  it.each(PAYOUT_STATUSES)(
    "emits only valid entries for a %s payout with a negative net",
    (status) => {
      const entries = entriesFor({
        payouts: [
          payout({ status, netAmount: "-35000.00", platformFee: "0.00", stripeFee: "0.00" }),
        ],
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ direction: "owed_by_you", amount: 3_500_000 });
    },
  );

  it("reports a clawback as owed by you, pending until it is reconciled", () => {
    const [entry] = entriesFor({
      payouts: [
        payout({
          status: "clawback_pending",
          netAmount: "-350.00",
          platformFee: "0.00",
          stripeFee: "0.00",
          processedAt: null,
        }),
      ],
    });
    expect(entry).toMatchObject({
      direction: "owed_by_you",
      status: "pending",
      amount: 35_000,
    });
  });

  it("drops amounts that are negative fees, zero, or not numbers instead of emitting them", () => {
    expect(
      entriesFor({
        payouts: [payout({ netAmount: "0.00", platformFee: "-5.00", stripeFee: "NaN" })],
      }),
    ).toEqual([]);
    expect(
      entriesFor({ payments: [payment({ amount: "NaN" }), payment({ amount: "-1.00" })] }),
    ).toEqual([]);
  });
});
