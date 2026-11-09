import { describe, expect, it } from "vitest";
import {
  type UnappliedMoney,
  possibleSourceText,
  unappliedMoneyAggregate,
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

  it("keys Shop money with no intent by its payment session, then by the Stripe event", () => {
    const shop = {
      ...base,
      reason: "shop_order_paid_after_close" as const,
      paymentId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeEventId: "evt_1",
    };
    expect(unappliedMoneyDedupeKey({ ...shop, shopCheckoutSessionId: "cs_1" })).toBe(
      "shop_order_paid_after_close:cs_1",
    );
    expect(unappliedMoneyDedupeKey(shop)).toBe("shop_order_paid_after_close:evt_1");
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

describe("possibleSourceText", () => {
  const group = { id: "abcdef12-0000-4000-8000-000000000000", status: "paid" as const };

  it("words the suggestion by the payment's state, always as a hedge", () => {
    expect(possibleSourceText(group)).toBe(
      "Possible overpayment of payment PG-ABCDEF12. Check before acting.",
    );
    for (const status of ["open", "processing"] as const) {
      expect(possibleSourceText({ ...group, status })).toBe(
        "May belong to the unpaid payment PG-ABCDEF12. Check before acting.",
      );
    }
  });

  it("says nothing without a suggestion", () => {
    expect(possibleSourceText(null)).toBeNull();
  });
});

describe("unappliedMoneyAggregate", () => {
  it("records a payment's money on the payment, and a group's on the group", () => {
    expect(unappliedMoneyAggregate(base, "key")).toEqual({
      aggregateType: "payment",
      aggregateId: "pay-1",
    });
    expect(unappliedMoneyAggregate({ paymentId: null, paymentGroupId: "grp-1" }, "key")).toEqual({
      aggregateType: "payment_group",
      aggregateId: "grp-1",
    });
  });

  it("records money that belongs to neither, such as a Shop order's, on its own key, so the event that closes it joins the same trail", () => {
    expect(
      unappliedMoneyAggregate(
        { paymentId: null, paymentGroupId: null },
        "shop_order_paid_after_close:pi_1",
      ),
    ).toEqual({
      aggregateType: "payment_group",
      aggregateId: "shop_order_paid_after_close:pi_1",
    });
  });
});
