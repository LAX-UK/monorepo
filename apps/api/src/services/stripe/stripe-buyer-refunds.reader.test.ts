import type { PaymentRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { GroupChargeRefund } from "../payment-group/payment-group-ports.js";
import { StripeBuyerRefundsReader } from "./stripe-buyer-refunds.reader.js";

const payment = (over: Partial<PaymentRecord> = {}): PaymentRecord =>
  ({
    id: "pay-1",
    amount: "600.10",
    stripeChargeId: "ch_1",
    paymentGroupId: null,
    status: "captured",
    ...over,
  }) as PaymentRecord;

function setup(record: PaymentRecord | null, refunds: GroupChargeRefund[] = [], configured = true) {
  const findById = vi.fn(async () => record);
  const listChargeRefunds = vi.fn(async () => refunds);
  const reader = new StripeBuyerRefundsReader(
    { findById },
    { isConfigured: () => configured, listChargeRefunds },
  );
  return { reader, findById, listChargeRefunds };
}

describe("StripeBuyerRefundsReader", () => {
  it("reads the refunds of the payment's own charge, not the seller's payout lines", async () => {
    const { reader, listChargeRefunds } = setup(payment(), [{ paymentId: null, amountPence: 500 }]);
    expect(await reader.refundedPence("pay-1")).toBe(500);
    expect(listChargeRefunds).toHaveBeenCalledExactlyOnceWith("ch_1");
  });

  it("is nothing for no refunds", async () => {
    expect(await setup(payment()).reader.refundedPence("pay-1")).toBe(0);
  });

  it("adds up several refunds on the charge", async () => {
    const { reader } = setup(payment(), [
      { paymentId: null, amountPence: 10_000 },
      { paymentId: null, amountPence: 25_000 },
    ]);
    expect(await reader.refundedPence("pay-1")).toBe(35_000);
  });

  it("reports a full refund as the whole amount", async () => {
    const { reader } = setup(payment(), [{ paymentId: null, amountPence: 60_010 }]);
    expect(await reader.refundedPence("pay-1")).toBe(60_010);
  });

  it("counts only the refunds naming the payment on a charge shared by several invoices", async () => {
    const { reader } = setup(payment({ paymentGroupId: "grp-1" }), [
      { paymentId: "pay-1", amountPence: 1_000 },
      { paymentId: "pay-2", amountPence: 9_000 },
      { paymentId: null, amountPence: 4_000 },
      { paymentId: "pay-1", amountPence: 2_000 },
    ]);
    expect(await reader.refundedPence("pay-1")).toBe(3_000);
  });

  it("never attributes a grouped payment more than it was", async () => {
    const { reader } = setup(payment({ paymentGroupId: "grp-1" }), [
      { paymentId: "pay-1", amountPence: 70_000 },
    ]);
    expect(await reader.refundedPence("pay-1")).toBe(60_010);
  });

  it("is nothing, without asking Stripe, for a payment with no Stripe charge or no payment", async () => {
    const noCharge = setup(payment({ stripeChargeId: null }));
    expect(await noCharge.reader.refundedPence("pay-1")).toBe(0);
    expect(noCharge.listChargeRefunds).not.toHaveBeenCalled();
    expect(await setup(null).reader.refundedPence("pay-1")).toBe(0);
  });

  it("is nothing while Stripe is not configured", async () => {
    const { reader, listChargeRefunds } = setup(payment(), [], false);
    expect(await reader.refundedPence("pay-1")).toBe(0);
    expect(listChargeRefunds).not.toHaveBeenCalled();
  });
});
