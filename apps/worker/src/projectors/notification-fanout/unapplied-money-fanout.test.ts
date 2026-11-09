import { possibleSourceText } from "@auction/domain";
import { FINANCE_ACCESS } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { alertFromUnappliedMoney, fanoutUnappliedMoney } from "./unapplied-money-fanout.js";

describe("unapplied money alert", () => {
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
