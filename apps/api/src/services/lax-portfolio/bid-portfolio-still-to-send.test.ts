import { type AmountOwedEntry, amountOwedEntry, decisivePayment } from "@auction/domain";
import { portfolioMoneyAgreement } from "@auction/lax-ecosystem/testing";
import type {
  BidPaymentFact,
  BidPaymentGroupFact,
  BidPortfolioFacts,
} from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { facts, payment, wonLot } from "../../testing/bid-portfolio-facts.js";
import {
  type BidPortfolioContext,
  buildBidMoneyEntries,
  buildBidPortfolioItems,
} from "./bid-portfolio.adapter.js";

const ctx: BidPortfolioContext = {
  webOrigin: "https://lax.bid",
  legalName: "London Auction Xchange LTD",
  imageUrl: () => null,
};

const LOT_A = "11111111-1111-4111-8111-111111111111";
const LOT_B = "66666666-6666-4666-8666-666666666666";

/** One combined bank transfer for two invoices: £8,000.00 and £3,701.00, £11,701.00 in all. */
const group = (over: Partial<BidPaymentGroupFact> = {}): BidPaymentGroupFact => ({
  id: "g1",
  status: "processing",
  checkoutRail: "gb_bank_transfer",
  totalAmount: "11701.00",
  amountReceived: "6000.00",
  ...over,
});

function transfer(
  over: Partial<BidPaymentGroupFact> = {},
  status: BidPaymentFact["status"] = "authorized",
) {
  return facts({
    wonLots: [wonLot({ lotId: LOT_A }), wonLot({ lotId: LOT_B, title: "Red Field" })],
    payments: [
      payment({ id: "pa", lotId: LOT_A, amount: "8000.00", status, group: group(over) }),
      payment({ id: "pb", lotId: LOT_B, amount: "3701.00", status, group: group(over) }),
    ],
  });
}

/** What the amounts-owed service derives, by the same domain rules. */
function owedFor(bid: BidPortfolioFacts) {
  const owed = new Map<string, AmountOwedEntry>();
  for (const lot of bid.wonLots) {
    const decisive = decisivePayment(bid.payments.filter((p) => p.lotId === lot.lotId));
    const entry = amountOwedEntry(
      {
        lotId: lot.lotId,
        paymentStatus: decisive?.status ?? null,
        fulfilmentStatus: null,
        paymentReviewReason: null,
        role: "payer",
        amountDue: decisive?.amount ?? "1150.00",
        currency: "GBP",
      },
      "clear",
    );
    if (entry) owed.set(lot.lotId, entry);
  }
  return owed;
}

function read(bid: BidPortfolioFacts) {
  const owed = owedFor(bid);
  const items = buildBidPortfolioItems(bid, ctx, owed);
  const entries = buildBidMoneyEntries(bid, ctx, owed);
  const [agreement] = portfolioMoneyAgreement(items, entries);
  return { items, entries, agreement };
}

describe("a part-funded bank transfer on Portfolio and Money", () => {
  it("shows what is still to send as owed, not as paid, and the two pages agree", () => {
    const { items, entries, agreement } = read(transfer());

    expect(items.map((item) => [item.id, item.status, item.owed?.state])).toEqual([
      [LOT_A, "awaiting_payment", "still_to_send"],
      [LOT_B, "awaiting_payment", "still_to_send"],
    ]);
    const owed = items.reduce((sum, item) => sum + (item.owed?.amount ?? 0), 0);
    expect(owed).toBe(570_100);
    expect(entries.filter((entry) => entry.direction === "owed_by_you")).toHaveLength(2);
    expect(entries.every((entry) => entry.direction === "owed_by_you")).toBe(true);
    expect(entries.every((entry) => entry.stillToSend === true)).toBe(true);
    // Nothing is paid until all of it arrives.
    expect(agreement).toMatchObject({
      totalDue: 570_100,
      owedByYou: 570_100,
      paidSoFar: 0,
      moneyPaid: 0,
    });
  });

  it("offers no second payment, only the work to look at", () => {
    const { items } = read(transfer());
    for (const item of items) {
      expect(item.actions.map((action) => action.kind)).toEqual(["view"]);
    }
  });

  it("owes nothing once the transfer has delivered everything and the invoices are paid", () => {
    const paid = transfer({ status: "paid", amountReceived: "11701.00" }, "captured");
    const { items, entries, agreement } = read(paid);
    expect(items.every((item) => item.owed === undefined)).toBe(true);
    expect(entries.every((entry) => entry.direction === "paid")).toBe(true);
    expect(agreement).toMatchObject({ totalDue: 0, owedByYou: 0, paidSoFar: 1_170_100 });
  });

  it("owes nothing when the transfer is fully funded but not yet settled", () => {
    const { items, entries } = read(transfer({ amountReceived: "11701.00" }));
    expect(items.map((item) => item.status)).toEqual(["payment_confirming", "payment_confirming"]);
    expect(items.every((item) => item.owed === undefined)).toBe(true);
    expect(entries).toEqual([]);
  });

  it("owes nothing when the transfer delivered more than was asked", () => {
    const { items, entries } = read(transfer({ amountReceived: "12000.00" }));
    expect(items.every((item) => item.owed === undefined)).toBe(true);
    expect(entries).toEqual([]);
  });

  it("shows nothing owed while nothing has arrived yet", () => {
    const { items } = read(transfer({ amountReceived: "0.00" }));
    expect(items.every((item) => item.owed?.state !== "still_to_send")).toBe(true);
  });

  it("leaves an unrelated payment alone", () => {
    const bid = facts({
      wonLots: [wonLot({ lotId: LOT_A }), wonLot({ lotId: LOT_B, title: "Red Field" })],
      payments: [
        payment({ id: "paid", lotId: LOT_A, amount: "1250.00", status: "captured" }),
        payment({
          id: "pb",
          lotId: LOT_B,
          amount: "3701.00",
          status: "authorized",
          group: group({ id: "other", checkoutRail: "card", amountReceived: "0.00" }),
        }),
      ],
    });
    const { items, entries } = read(bid);
    expect(items.find((item) => item.id === LOT_A)).toMatchObject({ status: "owned" });
    expect(items.find((item) => item.id === LOT_B)).toMatchObject({ status: "payment_confirming" });
    expect(items.every((item) => item.owed === undefined)).toBe(true);
    expect(entries.map((entry) => [entry.direction, entry.stillToSend])).toEqual([
      ["paid", undefined],
    ]);
  });
});
