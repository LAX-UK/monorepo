import { describe, expect, it } from "vitest";
import {
  type UnappliedMoney,
  unappliedMoneyDedupeKey,
  unappliedMoneyPayload,
} from "./unapplied-money.js";

const base: UnappliedMoney = {
  reason: "invoice_already_paid",
  paymentId: "pay-1",
  paymentGroupId: null,
  stripePaymentIntentId: "pi_1",
  stripeChargeId: "ch_1",
  stripeCustomerId: null,
  amountCents: 1000,
  currency: "gbp",
};

describe("unappliedMoneyDedupeKey", () => {
  it("keys card and transfer money by its intent, so a replay is the same task", () => {
    expect(unappliedMoneyDedupeKey(base)).toBe("invoice_already_paid:pi_1");
    expect(unappliedMoneyDedupeKey({ ...base, paymentId: "pay-other" })).toBe(
      "invoice_already_paid:pi_1",
    );
  });

  it("keys balance money by the Stripe event that reported it, not by customer and amount", () => {
    expect(
      unappliedMoneyDedupeKey({
        ...base,
        reason: "customer_balance_unapplied",
        paymentId: null,
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeCustomerId: "cus_1",
        stripeEventId: "evt_1:gbp",
      }),
    ).toBe("customer_balance_unapplied:evt_1:gbp");
  });

  it("the same money for a different reason is a different task", () => {
    expect(unappliedMoneyDedupeKey({ ...base, reason: "amount_mismatch" })).not.toBe(
      unappliedMoneyDedupeKey(base),
    );
  });

  it("the payload carries the key and an upper-case currency", () => {
    expect(unappliedMoneyPayload(base)).toMatchObject({
      currency: "GBP",
      dedupeKey: "invoice_already_paid:pi_1",
    });
  });
});
