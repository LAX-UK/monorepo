import { possibleSourceText } from "@auction/domain";
import { FINANCE_ACCESS } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { alertFromUnappliedMoney, fanoutUnappliedMoney } from "./unapplied-money-fanout.js";

describe("unapplied money alert", () => {
  it("tells finance a transfer was applied to another invoice, with the reference used and no provider named", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const alert = alertFromUnappliedMoney({
      reason: "transfer_applied_to_other_invoice",
      paymentId: "pay-9",
      paymentGroupId: null,
      stripePaymentIntentId: "pi_9",
      stripeChargeId: null,
      stripeCustomerId: "cus_1",
      transferReference: "REF-CANCELLED",
      amountCents: 5000,
      currency: "GBP",
      dedupeKey: "transfer_applied_to_other_invoice:ccsbtxn_1",
    });
    await fanoutUnappliedMoney({
      staffOpsRecipientReader: {
        listRecipients: vi
          .fn()
          .mockResolvedValue([{ id: "s", email: "f@lax.test", firstName: "F" }]),
      },
      emailService: { enqueue } as never,
      webOrigin: "https://lax.bid",
      eventId: 7,
      alert,
    });
    const situation = (enqueue.mock.calls[0]?.[0] as { vars: { situation: string } }).vars
      .situation;
    expect(situation).toContain("applied to a different invoice");
    expect(situation).toContain("Reference used: REF-CANCELLED.");
    expect(situation).not.toMatch(/stripe/i);
  });

  it("emails each finance member once per event, linking to the payment", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const listRecipients = vi
      .fn()
      .mockResolvedValue([{ id: "staff-1", email: "f@lax.test", firstName: "Fran" }]);
    await fanoutUnappliedMoney({
      staffOpsRecipientReader: { listRecipients },
      emailService: { enqueue } as never,
      webOrigin: "https://lax.bid/",
      eventId: 42,
      alert: alertFromUnappliedMoney({
        reason: "invoice_already_paid",
        paymentId: "pay-1",
        paymentGroupId: null,
        stripePaymentIntentId: "pi_2",
        stripeChargeId: "ch_2",
        stripeCustomerId: null,
        amountCents: 125000,
        currency: "GBP",
        dedupeKey: "invoice_already_paid:pi_2",
      }),
    });
    expect(listRecipients).toHaveBeenCalledWith(FINANCE_ACCESS);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "payment-unapplied-money-admin-notice",
        to: "f@lax.test",
        idempotencyKey: "payment-unapplied-money-admin-notice:42:ops:staff-1",
        vars: expect.objectContaining({
          situation: "A second payment arrived for an invoice that was already paid.",
          amount: "£1,250.00",
          reference: "pi_2",
          reviewUrl: "https://lax.bid/admin/payments?payment=pay-1",
        }),
      }),
    );
  });

  it("words a balance as a balance, and a suggested payment as a suggestion to check", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const alert = alertFromUnappliedMoney({
      reason: "customer_balance_unapplied",
      paymentId: null,
      paymentGroupId: null,
      possibleGroup: { id: "abcdef12-0000-4000-8000-000000000000", status: "open" },
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeCustomerId: "cus_1",
      amountCents: 35000,
      currency: "GBP",
      dedupeKey: "customer_balance_unapplied:evt:gbp",
    });
    await fanoutUnappliedMoney({
      staffOpsRecipientReader: {
        listRecipients: vi
          .fn()
          .mockResolvedValue([{ id: "staff-1", email: "f@lax.test", firstName: "Fran" }]),
      },
      emailService: { enqueue } as never,
      eventId: 7,
      alert,
    });
    const situation = enqueue.mock.calls[0]?.[0].vars.situation as string;
    expect(situation).toContain("The amount shown is the balance now");
    expect(situation).toContain(
      "May belong to the unpaid payment PG-ABCDEF12. Check before acting.",
    );
    expect(situation).not.toMatch(/overpa|sent more/i);
  });

  it("tells finance a Shop buyer paid after their order closed, naming the order the buyer quotes", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const alert = alertFromUnappliedMoney({
      reason: "shop_order_paid_after_close",
      paymentId: null,
      paymentGroupId: null,
      stripePaymentIntentId: "pi_1",
      stripeChargeId: null,
      stripeCustomerId: null,
      shopOrderId: "order-1",
      shopOrderReference: "LAX-S-10482",
      shopCheckoutSessionId: "cs_1",
      amountCents: 50500,
      currency: "GBP",
      dedupeKey: "shop_order_paid_after_close:pi_1",
    });
    expect(alert.reference).toBe("LAX-S-10482");
    await fanoutUnappliedMoney({
      staffOpsRecipientReader: {
        listRecipients: vi
          .fn()
          .mockResolvedValue([{ id: "staff-1", email: "f@lax.test", firstName: "Fran" }]),
      },
      emailService: { enqueue } as never,
      eventId: 9,
      webOrigin: "https://bid.example",
      laxAdminUrl: "https://admin.lax.art/",
      alert,
    });
    const vars = enqueue.mock.calls[0]?.[0].vars as {
      situation: string;
      reference: string;
      reviewUrl: string;
    };
    // The Shop order in LAX Admin, not the Bid admin payments list.
    expect(vars.reviewUrl).toBe("https://admin.lax.art/orders/order-1");
    expect(vars.situation).toContain("LAX Admin");
    expect(vars.situation).toContain("paid after their order had closed");
    expect(vars.situation).toContain("Nothing was refunded");
    expect(vars.reference).toBe("LAX-S-10482");
  });

  it("names LAX Admin and the order but carries no link, never localhost or Bid admin, when LAX Admin has no address set", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    await fanoutUnappliedMoney({
      staffOpsRecipientReader: {
        listRecipients: vi
          .fn()
          .mockResolvedValue([{ id: "staff-1", email: "f@lax.test", firstName: "Fran" }]),
      },
      emailService: { enqueue } as never,
      eventId: 10,
      webOrigin: "https://bid.example",
      alert: alertFromUnappliedMoney({
        reason: "shop_order_paid_after_close",
        paymentId: null,
        paymentGroupId: null,
        stripePaymentIntentId: "pi_1",
        stripeChargeId: null,
        stripeCustomerId: null,
        shopOrderId: "order-1",
        shopOrderReference: "LAX-S-10482",
        amountCents: 50500,
        currency: "GBP",
        dedupeKey: "shop_order_paid_after_close:pi_1",
      }),
    });
    const vars = enqueue.mock.calls[0]?.[0].vars as Record<string, unknown>;
    expect(vars).not.toHaveProperty("reviewUrl");
    expect(vars.situation).toContain("LAX Admin");
    expect(vars.reference).toBe("LAX-S-10482");
  });

  it.each([
    ["shop_order_amount_mismatch", "not their order's total"],
    ["shop_order_session_mismatch", "not the one their order was opened with"],
    ["shop_order_edition_state_invalid", "no longer reserved for it"],
    ["shop_order_paid_twice", "already paid received a second payment"],
  ] as const)(
    "tells finance about a Shop payment that could not be applied (%s), linking the order in LAX Admin",
    async (reason, words) => {
      const enqueue = vi.fn().mockResolvedValue(undefined);
      await fanoutUnappliedMoney({
        staffOpsRecipientReader: {
          listRecipients: vi
            .fn()
            .mockResolvedValue([{ id: "staff-1", email: "f@lax.test", firstName: "Fran" }]),
        },
        emailService: { enqueue } as never,
        eventId: 11,
        webOrigin: "https://bid.example",
        laxAdminUrl: "https://admin.lax.art",
        alert: alertFromUnappliedMoney({
          reason,
          paymentId: null,
          paymentGroupId: null,
          stripePaymentIntentId: "pi_1",
          stripeChargeId: null,
          stripeCustomerId: null,
          shopOrderId: "order-9",
          shopOrderReference: "LAX-S-10482",
          shopCheckoutSessionId: "cs_1",
          amountCents: 999,
          currency: "GBP",
          dedupeKey: `${reason}:pi_1`,
        }),
      });
      const vars = enqueue.mock.calls[0]?.[0].vars as {
        situation: string;
        reference: string;
        reviewUrl: string;
        amount: string;
      };
      expect(vars.situation).toContain(words);
      expect(vars.situation).toContain("Nothing was applied");
      expect(vars.situation).toContain("LAX Admin");
      expect(vars.reference).toBe("LAX-S-10482");
      expect(vars.amount).toContain("9.99");
      // The order in LAX Admin, never Bid admin's payments list.
      expect(vars.reviewUrl).toBe("https://admin.lax.art/orders/order-9");
    },
  );

  it("tells finance about a payment for an order that does not exist, with no link to open", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    await fanoutUnappliedMoney({
      staffOpsRecipientReader: {
        listRecipients: vi
          .fn()
          .mockResolvedValue([{ id: "staff-1", email: "f@lax.test", firstName: "Fran" }]),
      },
      emailService: { enqueue } as never,
      eventId: 12,
      webOrigin: "https://bid.example",
      laxAdminUrl: "https://admin.lax.art",
      alert: alertFromUnappliedMoney({
        reason: "shop_order_not_found",
        paymentId: null,
        paymentGroupId: null,
        stripePaymentIntentId: "pi_9",
        stripeChargeId: null,
        stripeCustomerId: null,
        shopOrderId: null,
        shopOrderReference: null,
        shopCheckoutSessionId: "cs_9",
        amountCents: 1200,
        currency: "GBP",
        dedupeKey: "shop_order_not_found:pi_9",
      }),
    });
    const vars = enqueue.mock.calls[0]?.[0].vars as Record<string, unknown>;
    expect(vars.situation).toContain("does not exist here");
    expect(vars.reference).toBe("pi_9");
    expect(vars).not.toHaveProperty("reviewUrl");
  });

  it("words the suggestion by the payment's state, and says nothing without one", () => {
    const paid = { id: "abcdef12-0000", status: "paid" as const };
    expect(possibleSourceText(paid)).toBe(
      "Possible overpayment of payment PG-ABCDEF12. Check before acting.",
    );
    for (const status of ["open", "processing"] as const) {
      expect(possibleSourceText({ ...paid, status })).toBe(
        "May belong to the unpaid payment PG-ABCDEF12. Check before acting.",
      );
    }
    expect(possibleSourceText(null)).toBeNull();
  });
});

describe("unapplied money alert for a private sale deal", () => {
  const deal = {
    reason: "private_sale_refund_after_payout" as const,
    paymentId: null,
    paymentGroupId: null,
    stripePaymentIntentId: null,
    stripeChargeId: null,
    stripeCustomerId: null,
    stripeEventId: "evt_9",
    privateSaleDealId: "deal-1",
    privateSaleDealReference: "PS-0012",
    privateSaleDealPaymentId: "dp-1",
    amountCents: 100000,
    currency: "GBP",
    dedupeKey: "private_sale_refund_after_payout:evt_9",
  };

  it("names the deal and opens it, and says the seller's payout may need adjusting", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    await fanoutUnappliedMoney({
      staffOpsRecipientReader: {
        listRecipients: vi
          .fn()
          .mockResolvedValue([{ id: "staff-1", email: "f@lax.test", firstName: "Fran" }]),
      },
      emailService: { enqueue } as never,
      webOrigin: "https://lax.bid/",
      eventId: 7,
      alert: alertFromUnappliedMoney(deal),
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        vars: expect.objectContaining({
          reference: "PS-0012",
          reviewUrl: "https://lax.bid/admin/private-sales/PS-0012",
          situation: expect.stringContaining("payout may need adjusting"),
        }),
      }),
    );
  });

  it("says money that a deal could not take is for finance to return or apply", () => {
    const alert = alertFromUnappliedMoney({ ...deal, reason: "private_sale_payment_not_applied" });
    expect(alert.situation).toBe("private_sale_payment_not_applied");
    expect(alert.dealReference).toBe("PS-0012");
  });
});
