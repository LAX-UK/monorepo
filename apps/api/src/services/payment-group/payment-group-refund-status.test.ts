import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { InMemoryPaymentRefunds } from "../../test/in-memory-payment-refunds.js";
import { StripePaymentGroupGateway } from "../stripe/stripe-payment-group.gateway.js";
import { PaymentGroupChargeEvents } from "./payment-group-charge-events.js";

/**
 * A group's refunds as their status moves on Stripe: only a refund that succeeded is counted, so
 * a pending refund that later fails never holds the stored total up, and a real refund of the same
 * amount afterwards is still announced, once. Stripe's refund list is read through the real
 * gateway, so the status rule under test is the one that runs.
 */

const GROUP = { id: "grp-1", buyerLegalEntityId: "buyer-1" };
// £100 and £50 invoices, and a £30 courier charge, all in one payment.
const MEMBERS = [
  { paymentId: "pay-a", amount: "100.00", sellerLegalEntityId: "seller-1" },
  { paymentId: "pay-b", amount: "50.00", sellerLegalEntityId: "seller-2" },
];
const DELIVERY = { quoteId: "q-1", lotId: "lot-1", amount: "30.00" };
const CHARGE = { id: "ch_group", currency: "gbp", payment_intent: "pi_group" } as Stripe.Charge;

type RefundStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";
type StripeRefund = {
  id: string;
  amount: number;
  status: RefundStatus;
  metadata: Record<string, string>;
};

const chargeRefunded = (id: string) => ({ id, type: "charge.refunded" }) as Stripe.Event;
const refundUpdated = (id: string) => ({ id, type: "charge.refund.updated" }) as Stripe.Event;

function setup() {
  // What Stripe holds for the charge; tests move statuses on as Stripe would.
  const stripeRefunds: StripeRefund[] = [];
  const list = vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      yield* stripeRefunds.map((r) => ({ ...r }));
    },
  }));
  const factory: IStripeClientFactory = {
    get: () => ({ refunds: { list } }) as unknown as Stripe,
    require: () => ({ refunds: { list } }) as unknown as Stripe,
  };
  const gateway = new StripePaymentGroupGateway(factory);

  const paymentRefunds = new InMemoryPaymentRefunds();
  const sellerLedger = new Map<string, number>();
  const lockPayouts = vi.fn(async (_input: { legalEntityIds: readonly string[] }) => {});
  const addLine = vi.fn(async (line: { paymentId: string; amount: string }) => {
    const pence = Math.round(Math.abs(Number(line.amount)) * 100);
    sellerLedger.set(line.paymentId, (sellerLedger.get(line.paymentId) ?? 0) + pence);
  });
  const publish = vi.fn().mockResolvedValue(undefined);
  const delivery = { ...DELIVERY, refundedPence: 0 };
  const unattributed = { pence: 0 };
  const seenEvents = new Set<string>();
  const events = new PaymentGroupChargeEvents({
    transactionRunner: {
      runInTransaction: async <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
    },
    groups: {
      findByStripeRefs: vi.fn().mockResolvedValue(GROUP),
      lockInTransaction: vi.fn(async () => ({
        group: GROUP,
        members: MEMBERS,
        deliveries: [{ ...delivery }],
        refundUnattributedPence: unattributed.pence,
      })),
      raiseDeliveryRefundedInTransaction: vi.fn(
        async (_tx: unknown, _g: string, _q: string, pence: number) => {
          if (delivery.refundedPence >= pence) return false;
          delivery.refundedPence = pence;
          return true;
        },
      ),
      raiseUnattributedRefundInTransaction: vi.fn(async (_tx: unknown, _g: string, p: number) => {
        if (unattributed.pence >= p) return false;
        unattributed.pence = p;
        return true;
      }),
    } as never,
    gateway,
    payments: { applyRefundedInTransaction: vi.fn().mockResolvedValue(true) },
    payoutAdjustments: {
      addPaymentLineToOpenPayoutOrCreateClawback: addLine,
      lockOpenPayoutsForSellers: lockPayouts,
    },
    paymentRefunds,
    sellerRefundedCents: async (_tx, paymentId) => sellerLedger.get(paymentId) ?? 0,
    events: { withTx: () => ({ publish }) } as never,
    // Stripe redelivers an event under its own id; a new id is a new event.
    claims: {
      claim: vi.fn(async (_tx: unknown, id: string) => {
        if (seenEvents.has(id)) return false;
        seenEvents.add(id);
        return true;
      }),
    },
  });

  const refund = (r: StripeRefund) => {
    stripeRefunds.push(r);
    return r;
  };
  const setStatus = (id: string, status: RefundStatus) => {
    const found = stripeRefunds.find((r) => r.id === id);
    if (!found) throw new Error(`no refund ${id}`);
    found.status = status;
  };
  const refundObject = (id: string) =>
    ({
      id,
      charge: CHARGE.id,
      payment_intent: "pi_group",
      currency: "gbp",
    }) as Stripe.Refund;
  const announced = (eventType: string) =>
    publish.mock.calls
      .map(([e]) => e as { eventType: string; payload: Record<string, unknown> })
      .filter((e) => e.eventType === eventType);

  return {
    events,
    paymentRefunds,
    sellerLedger,
    delivery,
    addLine,
    announced,
    refund,
    setStatus,
    refundObject,
  };
}

describe("group refunds count only once Stripe says they succeeded", () => {
  it("an invoice refund that is pending and then fails leaves nothing; a later real refund of the same £25 is announced once", async () => {
    const t = setup();
    t.refund({ id: "re_1", amount: 2_500, status: "pending", metadata: { paymentId: "pay-a" } });
    expect(await t.events.chargeRefunded(chargeRefunded("evt_1"), CHARGE)).toMatchObject({
      action: "skipped",
      reason: "no_new_refund_amount",
    });

    t.setStatus("re_1", "failed");
    expect(
      await t.events.refundUpdated(refundUpdated("evt_2"), t.refundObject("re_1")),
    ).toMatchObject({ reason: "no_new_refund_amount" });
    expect(t.paymentRefunds.entries).toEqual([]);
    expect(t.announced("payment.refunded")).toEqual([]);

    t.refund({ id: "re_2", amount: 2_500, status: "succeeded", metadata: { paymentId: "pay-a" } });
    expect(await t.events.chargeRefunded(chargeRefunded("evt_3"), CHARGE)).toEqual({
      processed: true,
      action: "refund_received",
    });
    // Redelivered, and then read again by a later event: nothing more.
    expect(await t.events.chargeRefunded(chargeRefunded("evt_3"), CHARGE)).toMatchObject({
      reason: "duplicate_event",
    });
    await t.events.refundUpdated(refundUpdated("evt_4"), t.refundObject("re_2"));

    expect(t.paymentRefunds.entries.map((e) => [e.paymentId, e.amountPence])).toEqual([
      ["pay-a", 2_500],
    ]);
    expect(t.sellerLedger.get("pay-a")).toBe(2_500);
    const refunded = t.announced("payment.refunded");
    expect(refunded).toHaveLength(1);
    expect(refunded[0]?.payload).toMatchObject({
      amountCents: 2_500,
      cumulativeRefundedCents: 2_500,
    });
  });

  it("a courier refund that is pending and then fails leaves nothing; a later real £30 refund is announced once", async () => {
    const t = setup();
    t.refund({
      id: "re_1",
      amount: 3_000,
      status: "requires_action",
      metadata: { deliveryQuoteId: "q-1" },
    });
    await t.events.chargeRefunded(chargeRefunded("evt_1"), CHARGE);
    t.setStatus("re_1", "failed");
    await t.events.refundUpdated(refundUpdated("evt_2"), t.refundObject("re_1"));
    expect(t.delivery.refundedPence).toBe(0);
    expect(t.announced("payment_group.delivery_refunded")).toEqual([]);

    t.refund({
      id: "re_2",
      amount: 3_000,
      status: "succeeded",
      metadata: { deliveryQuoteId: "q-1" },
    });
    await t.events.chargeRefunded(chargeRefunded("evt_3"), CHARGE);
    await t.events.chargeRefunded(chargeRefunded("evt_4"), CHARGE);

    expect(t.delivery.refundedPence).toBe(3_000);
    const announced = t.announced("payment_group.delivery_refunded");
    expect(announced).toHaveLength(1);
    expect(announced[0]?.payload).toMatchObject({
      cumulativeRefundedCents: 3_000,
      chargedCents: 3_000,
    });
    // A courier refund charges no seller back.
    expect(t.addLine).not.toHaveBeenCalled();
  });

  it("a pending refund that then succeeds is counted once, when Stripe reports it succeeded", async () => {
    const t = setup();
    t.refund({ id: "re_1", amount: 1_000, status: "pending", metadata: { paymentId: "pay-b" } });
    t.refund({ id: "re_2", amount: 500, status: "pending", metadata: { deliveryQuoteId: "q-1" } });
    await t.events.chargeRefunded(chargeRefunded("evt_1"), CHARGE);
    expect(t.paymentRefunds.entries).toEqual([]);

    t.setStatus("re_1", "succeeded");
    t.setStatus("re_2", "succeeded");
    expect(await t.events.refundUpdated(refundUpdated("evt_2"), t.refundObject("re_1"))).toEqual({
      processed: true,
      action: "refund_received",
    });
    // The second refund's own update, and a replayed charge.refunded, add nothing.
    expect(
      await t.events.refundUpdated(refundUpdated("evt_3"), t.refundObject("re_2")),
    ).toMatchObject({ reason: "no_new_refund_amount" });
    await t.events.chargeRefunded(chargeRefunded("evt_1_replayed"), CHARGE);

    expect(t.paymentRefunds.entries.map((e) => [e.paymentId, e.amountPence])).toEqual([
      ["pay-b", 1_000],
    ]);
    expect(t.announced("payment.refunded")).toHaveLength(1);
    expect(t.delivery.refundedPence).toBe(500);
    expect(t.announced("payment_group.delivery_refunded")).toHaveLength(1);
  });

  it("events that arrive out of order count each refund once", async () => {
    const t = setup();
    // Stripe already shows the refund succeeded when the update arrives first.
    t.refund({ id: "re_1", amount: 4_000, status: "succeeded", metadata: { paymentId: "pay-a" } });
    await t.events.refundUpdated(refundUpdated("evt_updated"), t.refundObject("re_1"));
    // The older charge.refunded arrives afterwards and reads the same list.
    expect(await t.events.chargeRefunded(chargeRefunded("evt_created"), CHARGE)).toMatchObject({
      reason: "no_new_refund_amount",
    });
    expect(t.paymentRefunds.entries.map((e) => e.amountPence)).toEqual([4_000]);
    expect(t.sellerLedger.get("pay-a")).toBe(4_000);
    expect(t.announced("payment.refunded")).toHaveLength(1);
  });

  it("never records a negative amount or lowers a total when Stripe later shows less", async () => {
    const t = setup();
    t.refund({ id: "re_1", amount: 2_000, status: "succeeded", metadata: { paymentId: "pay-a" } });
    t.refund({
      id: "re_2",
      amount: 1_000,
      status: "succeeded",
      metadata: { deliveryQuoteId: "q-1" },
    });
    await t.events.chargeRefunded(chargeRefunded("evt_1"), CHARGE);

    // A succeeded refund that Stripe later reports failed (rare): nothing is reversed here.
    t.setStatus("re_1", "failed");
    t.setStatus("re_2", "failed");
    expect(
      await t.events.refundUpdated(refundUpdated("evt_2"), t.refundObject("re_1")),
    ).toMatchObject({ reason: "no_new_refund_amount" });

    expect(t.paymentRefunds.entries.every((e) => e.amountPence > 0)).toBe(true);
    expect(t.paymentRefunds.entries.map((e) => e.amountPence)).toEqual([2_000]);
    expect(t.addLine.mock.calls.every(([line]) => Number(line.amount) < 0)).toBe(true);
    expect(t.delivery.refundedPence).toBe(1_000);
    expect(t.sellerLedger.get("pay-a")).toBe(2_000);
  });

  it("answers null for a refund on a charge that is not a group's, or that names no charge", async () => {
    const t = setup();
    const events = new PaymentGroupChargeEvents({
      groups: { findByStripeRefs: vi.fn().mockResolvedValue(null) },
    } as never);
    expect(await events.refundUpdated(refundUpdated("evt_1"), t.refundObject("re_1"))).toBeNull();
    expect(
      await t.events.refundUpdated(refundUpdated("evt_2"), {
        id: "re_x",
        charge: null,
      } as unknown as Stripe.Refund),
    ).toBeNull();
  });
});
