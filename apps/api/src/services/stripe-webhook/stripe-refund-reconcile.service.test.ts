import type { StripeRefundWatchRow } from "@auction/persistence/interfaces";
import { ok } from "neverthrow";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { FakeChargeRefunds } from "../../test/fake-charge-refunds.js";
import {
  REFUND_RECHECK_BASE_MS,
  REFUND_RECHECK_MAX_MS,
  StripeRefundReconcileService,
  refundRecheckDelayMs,
} from "./stripe-refund-reconcile.service.js";

const NOW = new Date("2026-11-13T10:00:00Z");

function setup(rows: StripeRefundWatchRow[]) {
  const stripe = new FakeChargeRefunds();
  const watch = {
    claimDue: vi.fn(async (limit: number) => rows.slice(0, limit)),
    reschedule: vi.fn(async () => undefined),
    markSettled: vi.fn(async () => undefined),
  };
  const settleCharge = vi.fn(async (_event: Stripe.Event, _charge: Stripe.Charge) => ({
    processed: true,
    action: "refund_received" as const,
  }));
  const completeStaffRefund = vi.fn(async () => ok(undefined));
  const service = new StripeRefundReconcileService({
    watch,
    refunds: stripe,
    settleCharge,
    completeStaffRefund,
    now: () => NOW,
  });
  return { stripe, watch, settleCharge, completeStaffRefund, service };
}

const row = (over: Partial<StripeRefundWatchRow> = {}): StripeRefundWatchRow => ({
  stripeRefundId: "re_1",
  stripeChargeId: "ch_1",
  status: "pending",
  amountPence: 2_500,
  paymentId: null,
  staffRefund: null,
  attempts: 0,
  ...over,
});

describe("StripeRefundReconcileService", () => {
  it("backs off from five minutes, doubling, to at most six hours", () => {
    expect(refundRecheckDelayMs(0)).toBe(REFUND_RECHECK_BASE_MS);
    expect(refundRecheckDelayMs(1)).toBe(2 * REFUND_RECHECK_BASE_MS);
    expect(refundRecheckDelayMs(3)).toBe(8 * REFUND_RECHECK_BASE_MS);
    expect(refundRecheckDelayMs(40)).toBe(REFUND_RECHECK_MAX_MS);
  });

  it("checks a refund still pending again later, settling nothing", async () => {
    const t = setup([row({ attempts: 2 })]);
    t.stripe.add({ id: "re_1", chargeId: "ch_1", amountPence: 2_500, status: "pending" });
    expect(await t.service.run()).toEqual({ checked: 1, settled: 0, stillPending: 1, failed: 0 });
    expect(t.settleCharge).not.toHaveBeenCalled();
    expect(t.watch.reschedule).toHaveBeenCalledWith("re_1", {
      status: "pending",
      nextCheckAt: new Date(NOW.getTime() + 4 * REFUND_RECHECK_BASE_MS),
      lastError: null,
    });
    expect(t.watch.markSettled).not.toHaveBeenCalled();
  });

  it("settles a refund that succeeded through the charge's own path, under an id per refund and status", async () => {
    const t = setup([row()]);
    t.stripe.add({ id: "re_1", chargeId: "ch_1", amountPence: 2_500, status: "succeeded" });
    t.stripe.charges.set("ch_1", { id: "ch_1", amount: 10_000 } as Stripe.Charge);
    expect(await t.service.run()).toMatchObject({ settled: 1 });
    const [event, charge] = t.settleCharge.mock.calls[0] ?? [];
    expect(event?.id).toBe("refund_reconcile:re_1:succeeded");
    expect(charge?.id).toBe("ch_1");
    expect(t.watch.markSettled).toHaveBeenCalledWith("re_1", "succeeded", NOW);
    expect(t.completeStaffRefund).not.toHaveBeenCalled();
  });

  it("settles a refund that failed the same way, so a counted one is taken back", async () => {
    const t = setup([row()]);
    t.stripe.add({ id: "re_1", chargeId: "ch_1", amountPence: 2_500, status: "failed" });
    t.stripe.charges.set("ch_1", { id: "ch_1" } as Stripe.Charge);
    await t.service.run();
    expect(t.settleCharge.mock.calls[0]?.[0].id).toBe("refund_reconcile:re_1:failed");
    expect(t.watch.markSettled).toHaveBeenCalledWith("re_1", "failed", NOW);
  });

  it("records a staff refund made while pending as that staff refund once it succeeds, never if it fails", async () => {
    const staffRefund = {
      paymentId: "00000000-0000-4000-8000-000000000001",
      adminUserId: "admin-1",
      via: "admin_manual",
      staffReason: "Buyer withdrew",
      sourceEventId: "admin_refund:00000000-0000-4000-8000-000000000001",
      clawbackNote: "Admin refund",
      logViaField: false,
    };
    const t = setup([
      row({ stripeRefundId: "re_ok", staffRefund }),
      row({ stripeRefundId: "re_bad", staffRefund }),
    ]);
    t.stripe.add({ id: "re_ok", chargeId: "ch_1", amountPence: 2_500, status: "succeeded" });
    t.stripe.add({ id: "re_bad", chargeId: "ch_1", amountPence: 2_500, status: "canceled" });
    t.stripe.charges.set("ch_1", { id: "ch_1" } as Stripe.Charge);
    await t.service.run();
    expect(t.completeStaffRefund).toHaveBeenCalledTimes(1);
    expect(t.completeStaffRefund).toHaveBeenCalledWith(
      expect.objectContaining({ adminUserId: "admin-1", staffReason: "Buyer withdrew" }),
      "re_ok",
    );
  });

  it("an error leaves the refund to be tried again with backoff, and the rest of the batch runs", async () => {
    const t = setup([
      row({ stripeRefundId: "re_gone", attempts: 1 }),
      row({ stripeRefundId: "re_2" }),
    ]);
    t.stripe.add({ id: "re_2", chargeId: "ch_1", amountPence: 100, status: "succeeded" });
    t.stripe.charges.set("ch_1", { id: "ch_1" } as Stripe.Charge);
    expect(await t.service.run()).toEqual({ checked: 2, settled: 1, stillPending: 0, failed: 1 });
    expect(t.watch.reschedule).toHaveBeenCalledWith("re_gone", {
      status: "pending",
      nextCheckAt: new Date(NOW.getTime() + 2 * REFUND_RECHECK_BASE_MS),
      lastError: "no refund re_gone",
    });
    expect(t.watch.markSettled).toHaveBeenCalledTimes(1);
  });

  it("takes a bounded batch", async () => {
    const t = setup([]);
    await t.service.run({ limit: 10_000 });
    await t.service.run({ limit: 0 });
    expect(t.watch.claimDue.mock.calls.map(([limit]) => limit)).toEqual([200, 1]);
  });
});
