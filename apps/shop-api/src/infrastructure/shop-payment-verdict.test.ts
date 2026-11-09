import { describe, expect, it } from "vitest";
import { type OrderForPayment, judgePayment } from "./shop-payment-verdict.js";

const own = "cs_own";
const order = (overrides: Partial<OrderForPayment> = {}): OrderForPayment => ({
  status: "pending_payment",
  totalPence: 1000,
  stripeCheckoutSessionId: own,
  ...overrides,
});
const pay = (overrides: Partial<{ sessionId: string; amountTotalPence: number }> = {}) => ({
  sessionId: own,
  amountTotalPence: 1000,
  ...overrides,
});

describe("judgePayment: the order of the checks", () => {
  it.each([
    ["pending, own session, right amount", order(), pay(), { kind: "apply" }],
    [
      "pending, no session yet, right amount",
      order({ stripeCheckoutSessionId: null }),
      pay(),
      { kind: "apply" },
    ],
    [
      "pending, stale session AND wrong amount: the session is named first",
      order(),
      pay({ sessionId: "cs_stale", amountTotalPence: 1 }),
      { kind: "unapplied", failure: "session_mismatch" },
    ],
    [
      "pending, own session, wrong amount",
      order(),
      pay({ amountTotalPence: 1 }),
      { kind: "unapplied", failure: "amount_mismatch" },
    ],
    ["paid, same session", order({ status: "paid" }), pay(), { kind: "already_applied" }],
    [
      "paid, same session, wrong amount: already done, the amount is not looked at",
      order({ status: "paid" }),
      pay({ amountTotalPence: 1 }),
      { kind: "already_applied" },
    ],
    [
      "paid, another session",
      order({ status: "paid" }),
      pay({ sessionId: "cs_second" }),
      { kind: "unapplied", failure: "paid_twice" },
    ],
    [
      "paid, no session on the order, a Checkout payment: a second payment",
      order({ status: "paid", stripeCheckoutSessionId: null }),
      pay(),
      { kind: "unapplied", failure: "paid_twice" },
    ],
    ["refunded, same session", order({ status: "refunded" }), pay(), { kind: "already_applied" }],
    [
      "partially refunded, same session",
      order({ status: "partially_refunded" }),
      pay(),
      { kind: "already_applied" },
    ],
    [
      "refunded, another session: money for a closed order",
      order({ status: "refunded" }),
      pay({ sessionId: "cs_second" }),
      { kind: "unapplied", failure: "paid_after_close" },
    ],
    [
      "refunded, no session on the order: money for a closed order",
      order({ status: "refunded", stripeCheckoutSessionId: null }),
      pay(),
      { kind: "unapplied", failure: "paid_after_close" },
    ],
    [
      "expired, even with a wrong amount: closed comes before the amount",
      order({ status: "expired" }),
      pay({ amountTotalPence: 1 }),
      { kind: "unapplied", failure: "paid_after_close" },
    ],
    [
      "payment_failed",
      order({ status: "payment_failed" }),
      pay(),
      { kind: "unapplied", failure: "paid_after_close" },
    ],
    [
      "cancelled",
      order({ status: "cancelled" }),
      pay({ sessionId: "cs_stale" }),
      { kind: "unapplied", failure: "paid_after_close" },
    ],
  ])("%s", (_name, forOrder, payment, expected) => {
    expect(judgePayment(forOrder, payment)).toEqual(expected);
  });
});
