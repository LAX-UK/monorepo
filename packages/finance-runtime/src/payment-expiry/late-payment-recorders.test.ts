import { describe, expect, it, vi } from "vitest";
import {
  CapturingLatePaymentRecorder,
  FinanceTaskLatePaymentRecorder,
} from "./late-payment-recorders.js";

const runner = { runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never) };
const paid = (amountReceivedPence: number) => ({
  paymentId: "pay-1",
  amountPence: 125_000,
  buyerLegalEntityId: "le-1",
  state: {
    kind: "paid" as const,
    paymentIntentId: "pi_1",
    chargeId: "ch_1",
    amountReceivedPence,
  },
});

describe("CapturingLatePaymentRecorder (API)", () => {
  it("captures the invoice through the webhook's path when the amount matches", async () => {
    const capture = vi.fn().mockResolvedValue({ captured: true });
    const record = vi.fn();
    await new CapturingLatePaymentRecorder({ capture }, { record }, runner as never).recordPaid(
      paid(125_000),
    );
    expect(capture).toHaveBeenCalledWith({
      paymentId: "pay-1",
      via: "stripe_payment_intent",
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("never captures a different amount: finance gets the task", async () => {
    const capture = vi.fn();
    const record = vi.fn().mockResolvedValue(undefined);
    await new CapturingLatePaymentRecorder({ capture }, { record }, runner as never).recordPaid(
      paid(100_000),
    );
    expect(capture).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: "amount_mismatch", amountCents: 100_000 }),
      "le-1",
    );
  });
});

describe("FinanceTaskLatePaymentRecorder (worker)", () => {
  it("leaves the invoice open and asks finance to record the payment", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    await new FinanceTaskLatePaymentRecorder({ record }, runner as never).recordPaid(paid(125_000));
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reason: "paid_not_recorded",
        paymentId: "pay-1",
        stripePaymentIntentId: "pi_1",
      }),
      "le-1",
    );
  });
});
