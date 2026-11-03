import type { ManualReviewReason, PaymentStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type AmountOwedEntry,
  type AmountOwedFacts,
  amountOwedEntry,
  summariseAmountsOwed,
} from "./amounts-owed.js";

const base: AmountOwedFacts = {
  lotId: "lot-1",
  paymentStatus: null,
  fulfilmentStatus: null,
  paymentReviewReason: null,
  role: "payer",
  amountDue: "1150.00",
  currency: "GBP",
};

const entryFor = (
  patch: Partial<AmountOwedFacts>,
  hold: "clear" | "aml_hold" | "source_of_funds_required" = "clear",
) => amountOwedEntry({ ...base, ...patch }, hold);

describe("amountOwedEntry", () => {
  it("owes the full total when no payment has started", () => {
    expect(entryFor({})).toEqual({
      lotId: "lot-1",
      state: "payment-due",
      role: "payer",
      amountDue: "1150.00",
      currency: "GBP",
      blocker: null,
    });
  });

  it("owes an unpaid invoice", () => {
    expect(entryFor({ paymentStatus: "pending" })?.state).toBe("payment-due");
  });

  it("still owes after an abandoned checkout", () => {
    expect(entryFor({ paymentStatus: "cancelled" })?.state).toBe("payment-due");
  });

  it("is in review while the payment is held, and names what is needed", () => {
    const reason: ManualReviewReason = "source_of_funds_required";
    expect(
      entryFor({ paymentStatus: "requires_manual_review", paymentReviewReason: reason }),
    ).toMatchObject({ state: "in-review", blocker: "documents" });
    expect(
      entryFor({ paymentStatus: "requires_manual_review", paymentReviewReason: "aml_hold" }),
    ).toMatchObject({ state: "in-review", blocker: "review" });
    expect(entryFor({ paymentStatus: "requires_manual_review" })).toMatchObject({
      state: "in-review",
      blocker: "review",
    });
  });

  it("is in review while the account has open checks", () => {
    expect(entryFor({}, "source_of_funds_required")).toMatchObject({
      state: "in-review",
      blocker: "documents",
    });
    expect(entryFor({ paymentStatus: "pending" }, "aml_hold")).toMatchObject({
      state: "in-review",
      blocker: "review",
    });
  });

  it("names no blocker for someone who is only told about the purchase", () => {
    expect(entryFor({ role: "informed" }, "source_of_funds_required")).toMatchObject({
      state: "in-review",
      blocker: null,
    });
  });

  it.each<PaymentStatus>(["authorized", "captured", "refunded"])(
    "owes nothing when the payment is %s",
    (paymentStatus) => {
      expect(entryFor({ paymentStatus }, "aml_hold")).toBeNull();
    },
  );

  it("ends as cancelled when the sale was cancelled at fulfilment, whatever the payment", () => {
    for (const paymentStatus of [null, "pending", "cancelled", "captured"] as const) {
      expect(entryFor({ paymentStatus, fulfilmentStatus: "cancelled" }, "aml_hold")).toMatchObject({
        state: "cancelled",
        blocker: null,
      });
    }
  });

  it("does not list a refunded purchase even if fulfilment was cancelled", () => {
    expect(entryFor({ paymentStatus: "refunded", fulfilmentStatus: "cancelled" })).toBeNull();
  });
});

const entry = (patch: Partial<AmountOwedEntry>): AmountOwedEntry => ({
  lotId: "lot",
  state: "payment-due",
  role: "payer",
  amountDue: "100.00",
  currency: "GBP",
  blocker: null,
  ...patch,
});

describe("summariseAmountsOwed", () => {
  it("is empty when nothing is owed", () => {
    expect(summariseAmountsOwed([])).toEqual({
      count: 0,
      totals: [],
      payableCount: 0,
      inReview: false,
      blocker: null,
    });
  });

  it("counts and totals what the person pays, per currency", () => {
    const summary = summariseAmountsOwed([
      entry({ lotId: "a", amountDue: "100.00" }),
      entry({ lotId: "b", amountDue: "50.50" }),
      entry({ lotId: "c", amountDue: "10.00", currency: "USD" }),
    ]);
    expect(summary).toMatchObject({ count: 3, payableCount: 3, inReview: false });
    expect(summary.totals).toEqual([
      { currency: "GBP", amount: "150.50" },
      { currency: "USD", amount: "10.00" },
    ]);
  });

  it("leaves out cancelled sales and what someone else pays", () => {
    const summary = summariseAmountsOwed([
      entry({ lotId: "a" }),
      entry({ lotId: "b", state: "cancelled" }),
      entry({ lotId: "c", role: "informed" }),
      entry({ lotId: "d", role: "none" }),
    ]);
    expect(summary.count).toBe(1);
    expect(summary.totals).toEqual([{ currency: "GBP", amount: "100.00" }]);
  });

  it("is in review when every owed lot is held, and asks for documents once", () => {
    const summary = summariseAmountsOwed([
      entry({ lotId: "a", state: "in-review", blocker: "review" }),
      entry({ lotId: "b", state: "in-review", blocker: "documents" }),
      entry({ lotId: "c", state: "in-review", blocker: "documents" }),
    ]);
    expect(summary).toMatchObject({
      count: 3,
      payableCount: 0,
      inReview: true,
      blocker: "documents",
    });
  });

  it("is not in review while something can be paid", () => {
    const summary = summariseAmountsOwed([
      entry({ lotId: "a", state: "in-review", blocker: "review" }),
      entry({ lotId: "b" }),
    ]);
    expect(summary).toMatchObject({
      count: 2,
      payableCount: 1,
      inReview: false,
      blocker: "review",
    });
  });

  it("counts a lot without a price but adds nothing to the total", () => {
    const summary = summariseAmountsOwed([entry({ amountDue: null })]);
    expect(summary).toMatchObject({ count: 1, totals: [] });
  });
});
