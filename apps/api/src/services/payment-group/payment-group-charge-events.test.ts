import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { InMemoryPaymentRefunds } from "../../test/in-memory-payment-refunds.js";
import { PaymentGroupChargeEvents } from "./payment-group-charge-events.js";

const GROUP = { id: "grp-1", buyerLegalEntityId: "buyer-1" };
const members = [
  { paymentId: "pay-a", amount: "100.00", sellerLegalEntityId: "seller-1" },
  { paymentId: "pay-b", amount: "50.00", sellerLegalEntityId: "seller-2" },
];

const charge = { id: "ch_group", currency: "gbp", payment_intent: "pi_group" } as Stripe.Charge;
const event = (id: string) => ({ id, type: "charge.refunded" }) as Stripe.Event;

function setup(
  refunds: { paymentId: string | null; amountPence: number }[],
  opts: {
    claimed?: boolean;
    paymentRefunds?: InMemoryPaymentRefunds;
    /** Pence the seller's ledger already holds as refunded, per payment (a refund the previous release handled). */
    sellerLedger?: Map<string, number>;
  } = {},
) {
  const paymentRefunds = opts.paymentRefunds ?? new InMemoryPaymentRefunds();
  const sellerLedger = opts.sellerLedger ?? new Map<string, number>();
  // A clawback line lands in the seller's ledger, as it does in the payout lines table.
  const addLine = vi.fn(async (line: { paymentId: string; amount: string }) => {
    const pence = Math.round(Math.abs(Number(line.amount)) * 100);
    sellerLedger.set(line.paymentId, (sellerLedger.get(line.paymentId) ?? 0) + pence);
  });
  const applyRefunded = vi.fn().mockResolvedValue(true);
  const publish = vi.fn().mockResolvedValue(undefined);
  let current = refunds;
  const events = new PaymentGroupChargeEvents({
    transactionRunner: {
      runInTransaction: async <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
    },
    groups: {
      findByStripeRefs: vi.fn().mockResolvedValue(GROUP),
      lockInTransaction: vi.fn().mockImplementation(async () => ({
        group: GROUP,
        members: [...members].reverse(),
        deliveries: [],
      })),
    } as never,
    gateway: { listChargeRefunds: vi.fn(async () => current) },
    payments: { applyRefundedInTransaction: applyRefunded },
    payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    paymentRefunds,
    sellerRefundedCents: async (_tx, paymentId) => sellerLedger.get(paymentId) ?? 0,
    events: { withTx: () => ({ publish }) } as never,
    claims: { claim: vi.fn().mockResolvedValue(opts.claimed ?? true) },
  });
  return {
    events,
    paymentRefunds,
    sellerLedger,
    addLine,
    applyRefunded,
    publish,
    setRefunds: (next: typeof refunds) => {
      current = next;
    },
  };
}

describe("PaymentGroupChargeEvents.chargeRefunded", () => {
  it("records each invoice's own refunds, keyed by the event and the payment", async () => {
    const { events, paymentRefunds } = setup([
      { paymentId: "pay-a", amountPence: 2_500 },
      { paymentId: "pay-b", amountPence: 1_000 },
    ]);
    const result = await events.chargeRefunded(event("evt_1"), charge);
    expect(result).toEqual({ processed: true, action: "refund_received" });
    expect(paymentRefunds.entries).toEqual([
      {
        paymentId: "pay-a",
        idempotencyKey: "evt_1:pay-a",
        amountPence: 2_500,
        currency: "GBP",
        source: "group_webhook",
      },
      {
        paymentId: "pay-b",
        idempotencyKey: "evt_1:pay-b",
        amountPence: 1_000,
        currency: "GBP",
        source: "group_webhook",
      },
    ]);
  });

  it("records only what is new on a later refund of the same invoice", async () => {
    const { events, paymentRefunds, setRefunds } = setup([
      { paymentId: "pay-a", amountPence: 2_500 },
    ]);
    await events.chargeRefunded(event("evt_1"), charge);
    setRefunds([
      { paymentId: "pay-a", amountPence: 2_500 },
      { paymentId: "pay-a", amountPence: 7_500 },
    ]);
    await events.chargeRefunded(event("evt_2"), charge);
    expect(paymentRefunds.entries.map((e) => e.amountPence)).toEqual([2_500, 7_500]);
  });

  it("records nothing for an event reported twice, whether claimed again or not", async () => {
    const { events, paymentRefunds } = setup([{ paymentId: "pay-a", amountPence: 2_500 }]);
    await events.chargeRefunded(event("evt_1"), charge);
    const replay = await events.chargeRefunded(event("evt_replayed"), charge);
    expect(replay).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(paymentRefunds.entries).toHaveLength(1);

    const duplicate = setup([{ paymentId: "pay-a", amountPence: 2_500 }], { claimed: false });
    expect(await duplicate.events.chargeRefunded(event("evt_1"), charge)).toMatchObject({
      reason: "duplicate_event",
    });
    expect(duplicate.paymentRefunds.entries).toEqual([]);
  });

  it("measures the invoices in id order, each summed before it is recorded", async () => {
    const { events, paymentRefunds } = setup([
      { paymentId: "pay-a", amountPence: 2_500 },
      { paymentId: "pay-b", amountPence: 1_000 },
    ]);
    await events.chargeRefunded(event("evt_1"), charge);
    // Members are taken in id order, whatever order the group returned them in.
    expect(paymentRefunds.calls).toEqual([
      "lock:pay-a",
      "sum:pay-a",
      "record:pay-a",
      "lock:pay-b",
      "sum:pay-b",
      "record:pay-b",
    ]);
  });

  it("records a refund the previous release handled without charging the seller back again", async () => {
    const sellerLedger = new Map([["pay-a", 2_500]]);
    const { events, paymentRefunds, addLine, publish } = setup(
      [{ paymentId: "pay-a", amountPence: 2_500 }],
      { sellerLedger },
    );
    const result = await events.chargeRefunded(event("evt_gap"), charge);
    expect(result).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(paymentRefunds.entries).toMatchObject([
      { idempotencyKey: "evt_gap:pay-a", amountPence: 2_500 },
    ]);
    expect(addLine).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("charges the seller back only for what is new after a refund in the rollout gap", async () => {
    const sellerLedger = new Map([["pay-a", 2_500]]);
    const { events, paymentRefunds, addLine } = setup(
      [{ paymentId: "pay-a", amountPence: 10_000 }],
      {
        sellerLedger,
      },
    );
    await events.chargeRefunded(event("evt_next"), charge);
    expect(paymentRefunds.entries.map((e) => e.amountPence)).toEqual([10_000]);
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ amount: "-75.00" }));
  });

  it("does not count again a refund staff already recorded", async () => {
    const paymentRefunds = new InMemoryPaymentRefunds();
    await paymentRefunds.recordInTransaction(
      {},
      {
        paymentId: "pay-a",
        idempotencyKey: "re_staff",
        amountPence: 10_000,
        currency: "GBP",
        source: "staff",
      },
    );
    const { events, addLine } = setup([{ paymentId: "pay-a", amountPence: 10_000 }], {
      paymentRefunds,
      sellerLedger: new Map([["pay-a", 10_000]]),
    });
    const result = await events.chargeRefunded(event("evt_after_staff"), charge);
    expect(result).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(paymentRefunds.entries).toHaveLength(1);
    expect(addLine).not.toHaveBeenCalled();
  });

  it("keeps a refund above the invoice on the record, and reverses the seller by no more than the invoice", async () => {
    const { events, paymentRefunds, addLine, applyRefunded, setRefunds } = setup([
      { paymentId: "pay-a", amountPence: 12_000 },
    ]);
    await events.chargeRefunded(event("evt_1"), charge);
    expect((await paymentRefunds.sumRefundedPence("pay-a")).pence).toBe(12_000);
    expect(addLine).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        paymentId: "pay-a",
        amount: "-100.00",
        sourceEventId: "evt_1:pay-a",
      }),
    );
    expect(applyRefunded).toHaveBeenCalledExactlyOnceWith({}, "pay-a", null);

    // A further refund wholly above the invoice is kept and moves nothing for the seller.
    setRefunds([
      { paymentId: "pay-a", amountPence: 12_000 },
      { paymentId: "pay-a", amountPence: 5_000 },
    ]);
    await events.chargeRefunded(event("evt_2"), charge);
    expect((await paymentRefunds.sumRefundedPence("pay-a")).pence).toBe(17_000);
    expect(addLine).toHaveBeenCalledOnce();
  });

  it("reverses the seller only by the part of a refund that is within the invoice", async () => {
    const { events, addLine, setRefunds } = setup([{ paymentId: "pay-a", amountPence: 9_000 }]);
    await events.chargeRefunded(event("evt_1"), charge);
    setRefunds([
      { paymentId: "pay-a", amountPence: 9_000 },
      { paymentId: "pay-a", amountPence: 4_000 },
    ]);
    await events.chargeRefunded(event("evt_2"), charge);
    expect(addLine.mock.calls.map(([line]) => line.amount)).toEqual(["-90.00", "-10.00"]);
  });

  it("marks an invoice refunded only once it is refunded in full", async () => {
    const { events, applyRefunded } = setup([
      { paymentId: "pay-a", amountPence: 9_999 },
      { paymentId: "pay-b", amountPence: 5_000 },
    ]);
    await events.chargeRefunded(event("evt_1"), charge);
    expect(applyRefunded).toHaveBeenCalledExactlyOnceWith({}, "pay-b", null);
  });

  it("reports a refund naming no invoice, and records nothing for it", async () => {
    const { events, paymentRefunds, publish } = setup([
      { paymentId: null, amountPence: 700 },
      { paymentId: "pay-a", amountPence: 100 },
    ]);
    await events.chargeRefunded(event("evt_1"), charge);
    expect(paymentRefunds.entries.map((e) => e.paymentId)).toEqual(["pay-a"]);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment_group.refund_unattributed",
        payload: expect.objectContaining({ amountCents: 700 }),
      }),
    );
  });

  it("answers null for a charge that is not a group's", async () => {
    const { events } = setup([]);
    (
      events as unknown as { deps: { groups: { findByStripeRefs: unknown } } }
    ).deps.groups.findByStripeRefs = vi.fn().mockResolvedValue(null);
    expect(await events.chargeRefunded(event("evt_1"), charge)).toBeNull();
  });
});
