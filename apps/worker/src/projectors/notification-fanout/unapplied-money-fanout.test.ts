import { FINANCE_ACCESS } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  alertFromBlockedCapture,
  alertFromUnappliedMoney,
  fanoutUnappliedMoney,
} from "./unapplied-money-fanout.js";

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

  it("a blocked capture on a cancelled invoice alerts; on a refunded one the unapplied event does", () => {
    expect(
      alertFromBlockedCapture("pay-1", { statusBefore: "cancelled", amountCents: 100 }),
    ).toMatchObject({
      situation: "invoice_cancelled",
      paymentId: "pay-1",
    });
    expect(alertFromBlockedCapture("pay-1", { statusBefore: "refunded" })).toBeNull();
  });
});
