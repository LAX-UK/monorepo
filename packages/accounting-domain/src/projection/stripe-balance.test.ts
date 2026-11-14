import { describe, expect, it } from "vitest";
import {
  buildExpense,
  buildTransfer,
  expectedTotals,
  laxReference,
  parseLaxReference,
  stripeIdFromSourceId,
  stripeSourceId,
} from "../document.js";
import { parseRecord } from "../lifecycle.js";
import {
  type StripeAttribution,
  type StripeBalanceTransactionFacts,
  decideStripeBalanceTransaction,
} from "./stripe-balance.js";

const shop: StripeAttribution = { status: "attributed", product: "shop" };
const bid: StripeAttribution = { status: "attributed", product: "bid" };

function txn(over: Partial<StripeBalanceTransactionFacts> = {}): StripeBalanceTransactionFacts {
  return {
    id: "txn_1AbCdEfGhIjKlMnOpQrStUvW",
    type: "charge",
    currency: "gbp",
    amountPence: 12_345,
    feePence: 205,
    createdOn: "2026-11-13",
    payoutId: null,
    ...over,
  };
}

function decide(t: StripeBalanceTransactionFacts, a: StripeAttribution = shop) {
  const decided = decideStripeBalanceTransaction(t, a);
  if (!decided.ok) throw new Error(decided.refusal.message);
  return decided.value;
}

describe("stripeSourceId", () => {
  it("keeps the case of a Stripe id and reads it back", () => {
    const id = "txn_1AbCdEfGhIjKlMnOpQrStUvW";
    const encoded = stripeSourceId(id);
    expect(encoded).toEqual({ ok: true, value: "txn_1-ab-cd-ef-gh-ij-kl-mn-op-qr-st-uv-w" });
    expect(stripeIdFromSourceId(encoded.ok ? encoded.value : "")).toBe(id);
  });

  it("gives two ids that differ only in case two source ids", () => {
    const a = stripeSourceId("po_1Abc");
    const b = stripeSourceId("po_1aBc");
    expect(a.ok && b.ok && a.value !== b.value).toBe(true);
  });

  it("fits the longest Stripe id written all in capitals", () => {
    expect(stripeSourceId(`txn_${"A".repeat(24)}`).ok).toBe(true);
  });

  it("refuses anything that is not a Stripe id", () => {
    for (const bad of ["", "txn-1", "TXN_1", "txn_1-a", "txn_1 a", "txn_"]) {
      expect(stripeSourceId(bad).ok).toBe(false);
    }
    expect(stripeIdFromSourceId("txn_1-")).toBeNull();
    expect(stripeIdFromSourceId("txn_1-9")).toBeNull();
  });
});

describe("expense and transfer documents", () => {
  it("builds an expense of whole pence with no VAT, referenced by its source id", () => {
    const e = buildExpense({
      product: "bid",
      sourceId: "txn_1-a",
      category: "stripe_fees",
      spentOn: "2026-11-13",
      amountPence: 1,
      description: "Stripe fees txn_1A (charge)",
    });
    expect(e.ok && e.value.reference).toBe("LAX-BID-EXP-txn_1-a");
    expect(e.ok && e.value.entity).toBe("london_auction_xchange");
    expect(e.ok && expectedTotals(e.value)).toEqual({ netPence: 1, vatPence: 0, grossPence: 1 });
  });

  it("refuses zero, fractions, a bad date and a description with a line break", () => {
    const common = {
      product: "shop" as const,
      sourceId: "po_1",
      transferredOn: "2026-11-13",
      description: "Stripe payout po_1",
    };
    expect(buildTransfer({ ...common, amountPence: 0 }).ok).toBe(false);
    expect(buildTransfer({ ...common, amountPence: 1.5 }).ok).toBe(false);
    expect(buildTransfer({ ...common, amountPence: 1, transferredOn: "2026-02-30" }).ok).toBe(
      false,
    );
    expect(buildTransfer({ ...common, amountPence: 1, description: "a\nb" }).ok).toBe(false);
    expect(buildTransfer({ ...common, amountPence: 1 }).ok).toBe(true);
  });

  it("has references of their own kinds, and the life cycle reads them back", () => {
    const exp = laxReference("shop", "expense", "txn_1");
    const trf = laxReference("lax_art", "transfer", "po_1");
    expect(exp.ok && exp.value).toBe("LAX-SHOP-EXP-txn_1");
    expect(trf.ok && trf.value).toBe("LAX-ART-TRF-po_1");
    expect(parseLaxReference("LAX-SHOP-EXP-txn_1")).toMatchObject({ ok: true });
    const record = parseRecord(
      { kind: "transfer", reference: "LAX-ART-TRF-po_1", attempts: 0, status: "pending" },
      Date.now(),
    );
    expect(record.ok).toBe(true);
  });
});

describe("decideStripeBalanceTransaction", () => {
  it("books a charge's fee to the penny as an expense, and nothing of the charge itself", () => {
    const d = decide(txn({ amountPence: 10_000, feePence: 165 }));
    expect(d.action).toBe("book");
    if (d.action !== "book") return;
    expect(d.feePence).toBe(165);
    expect(d.payoutPence).toBe(0);
    expect(d.projection.documents).toHaveLength(1);
    expect(d.projection.documents[0]).toMatchObject({
      kind: "expense",
      reference: "LAX-SHOP-EXP-txn_1-ab-cd-ef-gh-ij-kl-mn-op-qr-st-uv-w",
      amountPence: 165,
      spentOn: "2026-11-13",
      paidFrom: "stripe_clearing",
      description: "Stripe fees txn_1AbCdEfGhIjKlMnOpQrStUvW (charge)",
    });
  });

  it("books a payout as a transfer of exactly what left the balance, under the payout's id", () => {
    const d = decide(
      txn({ id: "txn_2", type: "payout", amountPence: -98_765, feePence: 0, payoutId: "po_1Xy" }),
      bid,
    );
    expect(d.action === "book" && d.payoutPence).toBe(98_765);
    expect(d.action === "book" && d.projection.documents).toEqual([
      expect.objectContaining({
        kind: "transfer",
        reference: "LAX-BID-TRF-po_1-xy",
        amountPence: 98_765,
        from: "stripe_clearing",
        to: "bank",
      }),
    ]);
  });

  it("books an instant payout's fee as its own expense beside the transfer", () => {
    const d = decide(
      txn({ id: "txn_3", type: "payout", amountPence: -10_000, feePence: 150, payoutId: "po_9" }),
    );
    expect(d.action === "book" && d.projection.documents.map((x) => x.kind)).toEqual([
      "expense",
      "transfer",
    ]);
    expect(d.action === "book" && d.feePence + d.payoutPence).toBe(10_150);
  });

  it("books a dispute's fee, but never the disputed amount", () => {
    const d = decide(
      txn({ id: "txn_4", type: "adjustment", amountPence: -5_000, feePence: 2_000 }),
    );
    expect(d.action === "book" && d.feePence).toBe(2_000);
    expect(d.action === "book" && d.projection.documents).toHaveLength(1);
  });

  it("books one of Stripe's own fees by its amount", () => {
    const d = decide(txn({ id: "txn_5", type: "stripe_fee", amountPence: -499, feePence: 0 }));
    expect(d.action === "book" && d.feePence).toBe(499);
  });

  it("has nothing to book for a refund with no fee or a charge Stripe took nothing on", () => {
    expect(decide(txn({ type: "refund", amountPence: -2_000, feePence: 0 }))).toEqual({
      action: "nothing",
    });
    expect(decide(txn({ feePence: 0 }), { status: "unattributable" })).toEqual({
      action: "nothing",
    });
  });

  it("parks a fee given back, a reversed payout, bad amounts and money not in pounds", () => {
    expect(decide(txn({ type: "refund", amountPence: -100, feePence: -30 }))).toEqual({
      action: "park",
      reason: "fee_refund",
    });
    expect(decide(txn({ type: "stripe_fee", amountPence: 499, feePence: 0 }))).toEqual({
      action: "park",
      reason: "fee_refund",
    });
    expect(decide(txn({ type: "payout_failure", amountPence: 9_000, feePence: 0 }))).toEqual({
      action: "park",
      reason: "payout_reversed",
    });
    expect(
      decide(txn({ type: "payout", amountPence: 9_000, feePence: 0, payoutId: "po_1" })),
    ).toEqual({ action: "park", reason: "bad_amounts" });
    expect(decide(txn({ feePence: 1.5 }))).toEqual({ action: "park", reason: "bad_amounts" });
    expect(decide(txn({ currency: "eur" }))).toEqual({ action: "park", reason: "not_in_pounds" });
  });

  it("parks what no stored row attributes, or what stored rows attribute twice", () => {
    expect(decide(txn(), { status: "unattributable" })).toEqual({
      action: "park",
      reason: "unattributable",
    });
    expect(decide(txn(), { status: "conflict" })).toEqual({
      action: "park",
      reason: "attribution_conflict",
    });
  });

  it("gives the same documents for the same transaction every time", () => {
    expect(decide(txn())).toEqual(decide(txn()));
  });
});
