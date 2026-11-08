import type { PaymentGroupRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import {
  type PaymentGroupSettlementDeps,
  PaymentGroupSettlementService,
} from "./payment-group-settlement.service.js";

const TX = {} as never;
const EVENT_AT = new Date("2026-11-04T10:00:00Z");

const group = (over: Partial<PaymentGroupRecord> = {}): PaymentGroupRecord => ({
  id: "grp_1",
  buyerLegalEntityId: "org_1",
  createdByUserId: "user_1",
  status: "open",
  currency: "GBP",
  totalAmount: "11701.00",
  checkoutRail: "gb_bank_transfer",
  stripeCheckoutSessionId: "cs_1",
  stripePaymentIntentId: "pi_1",
  stripeChargeId: null,
  amountReceived: "0.00",
  receivedEventAt: null,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  settledAt: null,
  ...over,
});

function setup(
  current = group(),
  over: { moved?: boolean; recorded?: boolean; claimed?: boolean } = {},
) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const applyAuthorizedInTransaction = vi.fn();
  const recordReceivedInTransaction = vi.fn().mockResolvedValue(over.recorded ?? true);
  const transitionInTransaction = vi.fn().mockResolvedValue(over.moved ?? true);
  const record = vi.fn().mockResolvedValue(undefined);
  const deps: PaymentGroupSettlementDeps = {
    transactionRunner: { runInTransaction: async (fn: (tx: never) => unknown) => fn(TX) } as never,
    groups: {
      lockInTransaction: vi.fn().mockResolvedValue({
        group: current,
        members: [{ paymentId: "pay_a" }, { paymentId: "pay_b" }],
      }),
      transitionInTransaction,
      recordReceivedInTransaction,
      releaseMembersInTransaction: vi.fn().mockResolvedValue(["pay_a", "pay_b"]),
    } as never,
    payments: { applyAuthorizedInTransaction },
    capture: { captureInTransaction: vi.fn() } as never,
    events: mockDomainEventSink(publish),
    claims: { claim: vi.fn().mockResolvedValue(over.claimed ?? true) },
    receipt: { send: vi.fn() },
    unappliedMoney: { record },
    eligibility: { check: vi.fn() },
  };
  return {
    service: new PaymentGroupSettlementService(deps),
    publish,
    applyAuthorizedInTransaction,
    recordReceivedInTransaction,
    transitionInTransaction,
    record,
  };
}

describe("PaymentGroupSettlementService.release: a start that recorded its checkout", () => {
  it("lets the group stand when asked to release only a checkout-less group and one now exists", async () => {
    const t = setup(group({ status: "open", stripeCheckoutSessionId: "cs_late" }));
    const result = await t.service.release({
      eventId: null,
      groupId: "grp_1",
      reason: "checkout_abandoned",
      onlyIfNoCheckout: true,
    });
    expect(result).toMatchObject({ action: "skipped", reason: "checkout_recorded" });
    expect(t.transitionInTransaction).not.toHaveBeenCalled();
  });

  it("releases a checkout-less group as before", async () => {
    const t = setup(group({ status: "open", stripeCheckoutSessionId: null }));
    const result = await t.service.release({
      eventId: null,
      groupId: "grp_1",
      reason: "checkout_abandoned",
      onlyIfNoCheckout: true,
    });
    expect(result).toMatchObject({ action: "payment_intent_canceled" });
  });

  it("still releases a group with a checkout when the provider ended it (no flag)", async () => {
    const t = setup(group({ status: "open", stripeCheckoutSessionId: "cs_1" }));
    const result = await t.service.release({
      eventId: "evt_expired",
      groupId: "grp_1",
      reason: "checkout_expired",
    });
    expect(result).toMatchObject({ action: "payment_intent_canceled" });
  });
});

describe("PaymentGroupSettlementService.markProcessing: money received so far", () => {
  it("holds the invoices and stores what arrived, in a decimal amount, with the event time", async () => {
    const t = setup();
    const result = await t.service.markProcessing({
      eventId: "evt_1",
      groupId: "grp_1",
      received: { amountPence: 600_000, paymentIntentId: "pi_1", eventAt: EVENT_AT },
    });
    expect(result).toEqual({ processed: true, action: "payment_intent_partially_funded" });
    expect(t.transitionInTransaction).toHaveBeenCalledWith(TX, "grp_1", ["open"], "processing");
    expect(t.applyAuthorizedInTransaction).toHaveBeenCalledTimes(2);
    expect(t.recordReceivedInTransaction).toHaveBeenCalledWith(TX, "grp_1", {
      amount: "6000.00",
      eventAt: EVENT_AT,
    });
    expect(t.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment_group.bank_transfer_partially_funded",
        payload: expect.objectContaining({ receivedCents: 600_000, totalCents: 1_170_100 }),
      }),
    );
  });

  it("stores a later figure for a group already processing, without holding the invoices twice", async () => {
    const t = setup(group({ status: "processing" }), { moved: false });
    const result = await t.service.markProcessing({
      eventId: "evt_2",
      groupId: "grp_1",
      received: { amountPence: 900_000, paymentIntentId: "pi_1", eventAt: EVENT_AT },
    });
    expect(result).toEqual({ processed: true, action: "payment_intent_partially_funded" });
    expect(t.applyAuthorizedInTransaction).not.toHaveBeenCalled();
    expect(t.recordReceivedInTransaction).toHaveBeenCalled();
  });

  it("changes nothing when the figure was not applied because the event is older", async () => {
    const t = setup(group({ status: "processing" }), { moved: false, recorded: false });
    const result = await t.service.markProcessing({
      eventId: "evt_old",
      groupId: "grp_1",
      received: { amountPence: 100_000, paymentIntentId: "pi_1", eventAt: EVENT_AT },
    });
    expect(result).toMatchObject({ action: "skipped", reason: "payment_group_not_open" });
    expect(t.publish).not.toHaveBeenCalled();
  });

  it("does nothing for an event it already handled", async () => {
    const t = setup(group(), { claimed: false });
    const result = await t.service.markProcessing({
      eventId: "evt_1",
      groupId: "grp_1",
      received: { amountPence: 600_000, paymentIntentId: "pi_1", eventAt: EVENT_AT },
    });
    expect(result).toMatchObject({ processed: false, reason: "duplicate_event" });
    expect(t.recordReceivedInTransaction).not.toHaveBeenCalled();
  });

  it.each(["paid", "cancelled"] as const)(
    "ignores money reported for a %s group",
    async (status) => {
      const t = setup(group({ status }));
      const result = await t.service.markProcessing({
        eventId: "evt_1",
        groupId: "grp_1",
        received: { amountPence: 600_000, paymentIntentId: "pi_1", eventAt: EVENT_AT },
      });
      expect(result).toMatchObject({ action: "skipped", reason: "payment_group_not_open" });
      expect(t.recordReceivedInTransaction).not.toHaveBeenCalled();
      expect(t.applyAuthorizedInTransaction).not.toHaveBeenCalled();
    },
  );

  it("starts a transfer without a figure as before: the invoices are held, nothing stored", async () => {
    const t = setup();
    const result = await t.service.markProcessing({ eventId: "evt_1", groupId: "grp_1" });
    expect(result).toEqual({ processed: true, action: "payment_intent_processing" });
    expect(t.recordReceivedInTransaction).not.toHaveBeenCalled();
    expect(t.applyAuthorizedInTransaction).toHaveBeenCalledTimes(2);
  });

  it("raises a finance task, never a refund, when more than the total arrived", async () => {
    const t = setup(group({ status: "processing" }), { moved: false });
    await t.service.markProcessing({
      eventId: "evt_over",
      groupId: "grp_1",
      received: { amountPence: 1_200_000, paymentIntentId: "pi_1", eventAt: EVENT_AT },
    });
    expect(t.record).toHaveBeenCalledExactlyOnceWith(
      TX,
      expect.objectContaining({
        reason: "group_overpaid",
        paymentGroupId: "grp_1",
        stripePaymentIntentId: "pi_1",
        amountCents: 29_900,
      }),
      "org_1",
    );
  });

  it("raises nothing when the total or less arrived", async () => {
    const t = setup();
    await t.service.markProcessing({
      eventId: "evt_ok",
      groupId: "grp_1",
      received: { amountPence: 1_170_100, paymentIntentId: "pi_1", eventAt: EVENT_AT },
    });
    expect(t.record).not.toHaveBeenCalled();
  });
});
