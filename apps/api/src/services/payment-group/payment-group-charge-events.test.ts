import type { PaymentGroupMember } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { PaymentGroupChargeEvents } from "./payment-group-charge-events.js";

const member = (paymentId: string, amount: string): PaymentGroupMember => ({
  paymentId,
  lotId: `lot-${paymentId}`,
  lotTitle: "Work",
  lotNumber: null,
  amount,
  status: "captured",
  sellerLegalEntityId: `seller-${paymentId}`,
});

function setup(isGroup = true) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const payoutAdjustments = { addPaymentLineToOpenPayoutOrCreateClawback: vi.fn(async () => {}) };
  const events = new PaymentGroupChargeEvents({
    transactionRunner: { runInTransaction: (fn) => fn({} as never) },
    groups: {
      findByStripeRefs: vi.fn(async () =>
        isGroup ? ({ id: "group-1", buyerLegalEntityId: "org-1" } as never) : null,
      ),
      listMembers: vi.fn(async () => [member("a", "100.00"), member("b", "200.00")]),
    },
    gateway: { listChargeRefunds: vi.fn(async () => []) },
    payments: { applyRefundedInTransaction: vi.fn(async () => true) },
    payoutAdjustments,
    refundedCentsSoFar: async () => 0,
    events: mockDomainEventSink(publish),
    claims: { claim: async () => true },
  });
  return { events, publish, payoutAdjustments };
}

const dispute = (amount: number, status = "needs_response") =>
  ({
    id: "dp_1",
    charge: "ch_1",
    payment_intent: "pi_1",
    amount,
    currency: "gbp",
    reason: "fraudulent",
    status,
  }) as unknown as Stripe.Dispute;
const event = { id: "evt_1" } as Stripe.Event;

describe("disputes on a combined payment", () => {
  it("leaves a charge that is not a group's to the single-invoice handlers", async () => {
    const { events } = setup(false);
    expect(await events.dispute("created", event, dispute(30_000))).toBeNull();
  });

  it("falls on every invoice in full when the whole payment is disputed", async () => {
    const { events, publish, payoutAdjustments } = setup();
    await events.dispute("funds_withdrawn", event, dispute(30_000));
    expect(payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback.mock.calls).toEqual([
      [expect.objectContaining({ paymentId: "a", amount: "-100.00", legalEntityId: "seller-a" })],
      [expect.objectContaining({ paymentId: "b", amount: "-200.00", legalEntityId: "seller-b" })],
    ]);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.dispute_funds_withdrawn", aggregateId: "a" }),
    );
  });

  it("reverses each invoice's clawback when the dispute is won", async () => {
    const { events, payoutAdjustments } = setup();
    await events.dispute("closed", event, dispute(30_000, "won"));
    expect(payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback.mock.calls).toEqual([
      [expect.objectContaining({ paymentId: "a", amount: "100.00" })],
      [expect.objectContaining({ paymentId: "b", amount: "200.00" })],
    ]);
  });

  it("asks the finance team to allocate a dispute of part of the payment, moving no money", async () => {
    const { events, publish, payoutAdjustments } = setup();
    expect(await events.dispute("funds_withdrawn", event, dispute(10_000))).toMatchObject({
      reason: "needs_allocation",
    });
    expect(payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment_group.dispute_needs_allocation" }),
    );
  });
});
