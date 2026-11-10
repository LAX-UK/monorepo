import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { PaymentIntentSucceededHandler } from "./payment-intent-succeeded.handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";

vi.mock("../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn().mockResolvedValue({ claimed: true }),
}));

const event = { id: "evt_1" } as Stripe.Event;
const intent = {
  id: "pi_1",
  amount: 10_000,
  metadata: { paymentId: "pay-1" },
  latest_charge: "ch_1",
} as unknown as Stripe.PaymentIntent;

function setup(opts: { commitFails?: boolean; afterCommitFails?: boolean } = {}) {
  const order: string[] = [];
  const afterCommit = vi.fn(async () => {
    order.push("afterCommit");
    if (opts.afterCommitFails) throw new Error("receipt failed");
  });
  const report = vi.fn();
  const capture = vi.fn(async () => {
    order.push("capture");
    return { captured: true, afterCommit };
  });
  const runInTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const result = await fn({});
    order.push("commit");
    if (opts.commitFails) throw new Error("commit failed");
    return result;
  });
  const deps = {
    transactionRunner: { runInTransaction },
    paymentWebhookLookup: {},
    payments: {
      findById: vi.fn(async () => ({ id: "pay-1", amount: "100.00", status: "pending" })),
    },
    paymentCapture: { capture },
    paymentEligibility: null,
    errorReporter: { report },
  } as unknown as StripePaymentWebhookDeps;
  return { handler: new PaymentIntentSucceededHandler(deps), order, afterCommit, capture, report };
}

describe("PaymentIntentSucceededHandler capture ordering", () => {
  it("runs the capture's follow-up work only after the transaction commits", async () => {
    const { handler, order, capture } = setup();

    const result = await handler.handle(event, intent);

    expect(result).toEqual({ processed: true, action: "payment_intent_succeeded" });
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ tx: {}, requireApply: true }));
    expect(order).toEqual(["capture", "commit", "afterCommit"]);
  });

  it("never runs it when the transaction fails to commit", async () => {
    const { handler, afterCommit } = setup({ commitFails: true });

    await expect(handler.handle(event, intent)).rejects.toThrow("commit failed");

    expect(afterCommit).not.toHaveBeenCalled();
  });

  it("answers success and reports when the follow-up work fails after the commit", async () => {
    const { handler, order, report } = setup({ afterCommitFails: true });

    await expect(handler.handle(event, intent)).resolves.toEqual({
      processed: true,
      action: "payment_intent_succeeded",
    });

    expect(order).toEqual(["capture", "commit", "afterCommit"]);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ code: "payment_after_capture_failed", severity: "error" }),
    );
  });
});
