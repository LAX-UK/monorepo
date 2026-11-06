import { type AmountOwedEntry, amountOwedEntry, decisivePayment } from "@auction/domain";
import { portfolioMoneyAgreement } from "@auction/lax-ecosystem";
import type { BidPaymentFact, BidPortfolioFacts } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { facts, payment, wonLot } from "../../testing/bid-portfolio-facts.js";
import {
  type BidPortfolioContext,
  buildBidMoneyEntries,
  buildBidPortfolioItems,
} from "./bid-portfolio.adapter.js";

/**
 * Portfolio and Money are two readings of the same account. Whatever the payment history looks
 * like, "Total due" must equal "Owed by you" and "Paid so far" must equal what Money reports as paid.
 */
const ctx: BidPortfolioContext = {
  webOrigin: "https://lax.bid",
  legalName: "London Auction Xchange LTD",
  imageUrl: () => null,
};

const LOT = "11111111-1111-4111-8111-111111111111";
const OTHER_LOT = "66666666-6666-4666-8666-666666666666";

/** What the amounts-owed service would derive for each won lot, using the same domain rules. */
function owedFor(
  bid: BidPortfolioFacts,
  options: { fulfilment?: Record<string, string>; reviewLots?: string[] } = {},
): Map<string, AmountOwedEntry> {
  const owed = new Map<string, AmountOwedEntry>();
  for (const lot of bid.wonLots) {
    const attempts = bid.payments.filter((p) => p.lotId === lot.lotId);
    const decisive: BidPaymentFact | undefined = decisivePayment(attempts);
    const entry = amountOwedEntry(
      {
        lotId: lot.lotId,
        paymentStatus: decisive?.status ?? null,
        fulfilmentStatus: options.fulfilment?.[lot.lotId] ?? null,
        paymentReviewReason: options.reviewLots?.includes(lot.lotId) ? "aml_hold" : null,
        role: "payer",
        amountDue: "1150.00",
        currency: "GBP",
      },
      "clear",
    );
    if (entry) owed.set(lot.lotId, entry);
  }
  return owed;
}

function agreementFor(bid: BidPortfolioFacts, owed: Map<string, AmountOwedEntry>) {
  return portfolioMoneyAgreement(
    buildBidPortfolioItems(bid, ctx, owed),
    buildBidMoneyEntries(bid, ctx, owed),
  );
}

describe("Bid Portfolio and Money agree", () => {
  it("owes nothing on a lot paid after an abandoned attempt", () => {
    const bid = facts({
      wonLots: [wonLot()],
      payments: [
        payment({ id: "paid", status: "captured", createdAt: new Date("2026-03-03T09:00:00Z") }),
        payment({
          id: "abandoned",
          status: "pending",
          createdAt: new Date("2026-03-02T09:00:00Z"),
        }),
      ],
    });
    const [row] = agreementFor(bid, owedFor(bid));
    expect(row).toEqual({
      business: "lax_bid",
      currency: "GBP",
      totalDue: 0,
      owedByYou: 0,
      paidSoFar: 125_000,
      moneyPaid: 125_000,
    });
  });

  it("owes nothing on a paid lot even when an abandoned attempt is the newest row", () => {
    const bid = facts({
      wonLots: [wonLot()],
      payments: [
        payment({
          id: "abandoned",
          status: "pending",
          createdAt: new Date("2026-03-03T09:00:00Z"),
        }),
        payment({ id: "paid", status: "captured", createdAt: new Date("2026-03-02T09:00:00Z") }),
      ],
    });
    const [row] = agreementFor(bid, owedFor(bid));
    expect(row).toMatchObject({
      totalDue: 0,
      owedByYou: 0,
      paidSoFar: 125_000,
      moneyPaid: 125_000,
    });
  });

  it("owes an unpaid lot once, however many attempts were started", () => {
    const bid = facts({
      wonLots: [wonLot()],
      payments: [payment({ id: "a", status: "pending" }), payment({ id: "b", status: "pending" })],
    });
    const [row] = agreementFor(bid, owedFor(bid));
    expect(row).toMatchObject({
      totalDue: 115_000,
      owedByYou: 115_000,
      paidSoFar: 0,
      moneyPaid: 0,
    });
  });

  it("counts a held purchase as owed on both pages", () => {
    const bid = facts({
      wonLots: [wonLot()],
      payments: [payment({ status: "requires_manual_review" })],
    });
    const [row] = agreementFor(bid, owedFor(bid, { reviewLots: [LOT] }));
    expect(row).toMatchObject({ totalDue: 115_000, owedByYou: 115_000 });
  });

  it("counts a cancelled or expired attempt as one open invoice, not a second debt", () => {
    const bid = facts({
      wonLots: [wonLot()],
      payments: [
        payment({ id: "retry", status: "pending" }),
        payment({ id: "expired", status: "cancelled" }),
      ],
    });
    const [row] = agreementFor(bid, owedFor(bid));
    expect(row).toMatchObject({ totalDue: 115_000, owedByYou: 115_000 });
  });

  it("owes nothing on a sale cancelled at fulfilment", () => {
    const bid = facts({ wonLots: [wonLot()], payments: [payment({ status: "cancelled" })] });
    expect(agreementFor(bid, owedFor(bid, { fulfilment: { [LOT]: "cancelled" } }))).toEqual([]);
  });

  it("treats a refunded payment as paid and then returned", () => {
    const bid = facts({ wonLots: [wonLot()], payments: [payment({ status: "refunded" })] });
    const owed = owedFor(bid);
    const entries = buildBidMoneyEntries(bid, ctx, owed);
    const refunded = entries
      .filter((e) => e.direction === "refunded")
      .reduce((sum, e) => sum + e.amount, 0);
    const [row] = agreementFor(bid, owed);
    // The refunded work is no longer held, so Portfolio's paid figure is net of the refund.
    expect(row).toMatchObject({ totalDue: 0, owedByYou: 0, paidSoFar: 0 });
    expect(row?.moneyPaid).toBe(125_000);
    expect(row ? row.moneyPaid - refunded : null).toBe(row?.paidSoFar);
  });

  it("agrees across several lots with mixed histories", () => {
    const bid = facts({
      wonLots: [wonLot(), wonLot({ lotId: OTHER_LOT, title: "Second" })],
      payments: [
        payment({ id: "x", lotId: OTHER_LOT, status: "pending" }),
        payment({ id: "y", status: "captured" }),
        payment({ id: "z", status: "pending" }),
      ],
    });
    const [row] = agreementFor(bid, owedFor(bid));
    expect(row).toMatchObject({
      totalDue: 115_000,
      owedByYou: 115_000,
      paidSoFar: 125_000,
      moneyPaid: 125_000,
    });
  });
});
