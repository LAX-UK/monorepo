import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../test/domain-event-sink-mock.js";
import { InMemoryPaymentRefunds } from "../test/in-memory-payment-refunds.js";
import { transactionRunnerFromDb } from "../test/transaction-runner-from-db.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import { PaymentService } from "./payment.service.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment/payment-tier.policy.js";
import { staffRefundContextOf } from "./payment/refund-execution.js";
import type { StripeRefundGatewayResult } from "./stripe/stripe-payment-gateway.js";

const defaultTierPolicy = new PaymentTierPolicy(
  parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: 100_000,
    STRIPE_MANUAL_REVIEW_MIN: 500_000,
    STRIPE_ABSOLUTE_MAX: 999_999.99,
  }),
);

type Pay = {
  id: string;
  lotId: string;
  buyerId: string;
  amount: string;
  sellerLegalEntityId: string;
  stripeChargeId: string;
  status: "captured" | "requires_manual_review" | "refunded";
};

const created = (status: string, amountPence = 10_000): StripeRefundGatewayResult => ({
  kind: "created",
  refundId: "re_1",
  status,
  amountPence,
});

function setup(pay: Pay, outcome: StripeRefundGatewayResult) {
  const tx = {} as never;
  const db = { transaction: vi.fn(async (fn: (t: never) => Promise<void>) => fn(tx)) };
  const addClawback = vi.fn().mockResolvedValue(undefined);
  const payoutAdjustments = {
    addPaymentLineToOpenPayoutOrCreateClawback: addClawback,
  } as unknown as IPayoutAdjustmentService;
  const publish = vi.fn().mockResolvedValue(undefined);
  const paymentRefunds = new InMemoryPaymentRefunds();
  const row = { ...pay };
  const applyRefundedInTransaction = vi.fn(async () => {
    if (row.status === "refunded") return false;
    row.status = "refunded";
    return true;
  });
  const watch = vi.fn(async () => undefined);
  const createRefund = vi.fn().mockResolvedValue(outcome);
  const service = new PaymentService(
    { findById: vi.fn() } as never,
    { findById: vi.fn(async () => ({ ...row })), applyRefundedInTransaction } as never,
    null,
    { createPaymentReceived: vi.fn(), createSellerPaymentReceived: vi.fn() } as never,
    {} as never,
    {
      isConfigured: vi.fn().mockReturnValue(false),
      ensureInvoiceForPayment: vi.fn().mockResolvedValue({ ok: true }),
      syncPaymentFromProvider: vi.fn(),
      syncInvoiceFromProvider: vi.fn(),
    },
    defaultTierPolicy,
    undefined,
    transactionRunnerFromDb(db as never),
    mockDomainEventSink(publish) as never,
    {
      isConfigured: () => true,
      capturePaymentIntent: vi.fn(),
      createRefund,
      createCardCheckoutSession: vi.fn(),
      createBankTransferCheckoutSession: vi.fn(),
      retrievePaymentIntent: vi.fn(),
      retrieveCheckoutSession: vi.fn(),
      findChargeIdForPayment: vi.fn(),
      expireCheckoutSession: vi.fn().mockResolvedValue(undefined),
      cancelPaymentIntent: vi.fn().mockResolvedValue(undefined),
      revokeOpenCheckoutForPayment: vi.fn().mockResolvedValue(undefined),
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    null as unknown as IPaymentCaptureService,
    null,
    payoutAdjustments,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    paymentRefunds,
    { watch },
  );
  const refunded = () => publish.mock.calls.filter(([e]) => e.eventType === "payment.refunded");
  return { service, addClawback, paymentRefunds, watch, refunded, row, applyRefundedInTransaction };
}

const PAY: Pay = {
  id: "pay-1",
  lotId: "lot-1",
  buyerId: "buyer-1",
  amount: "100.00",
  sellerLegalEntityId: "le-seller",
  stripeChargeId: "ch_1",
  status: "captured",
};

describe("PaymentService.refundPayment admin clawback", () => {
  it("creates a seller payout clawback line after a successful Stripe refund", async () => {
    const t = setup(PAY, created("succeeded"));
    const result = await t.service.refundPayment("admin-1", "staff", PAY.id, undefined, [
      "administrator",
    ]);
    expect(result.isOk()).toBe(true);
    expect(t.addClawback).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "le-seller",
        paymentId: "pay-1",
        amount: "-100.00",
        kind: "refund",
      }),
    );
    expect(t.refunded()).toHaveLength(1);
    expect(t.watch).not.toHaveBeenCalled();
  });

  it.each(["pending", "requires_action"])(
    "records, announces and claws back nothing while Stripe's refund is %s, and watches it with who made it",
    async (status) => {
      const t = setup(PAY, created(status));
      const result = await t.service.refundPayment(
        "admin-1",
        "staff",
        PAY.id,
        undefined,
        ["administrator"],
        "Buyer withdrew",
      );
      expect(result.isOk()).toBe(true);
      expect(t.applyRefundedInTransaction).not.toHaveBeenCalled();
      expect(t.paymentRefunds.entries).toEqual([]);
      expect(t.addClawback).not.toHaveBeenCalled();
      expect(t.refunded()).toEqual([]);
      expect(t.watch).toHaveBeenCalledWith([
        expect.objectContaining({
          stripeRefundId: "re_1",
          stripeChargeId: "ch_1",
          status,
          amountPence: 10_000,
          paymentId: "pay-1",
          staffRefund: expect.objectContaining({
            adminUserId: "admin-1",
            via: "admin_manual",
            staffReason: "Buyer withdrew",
            sourceEventId: "admin_refund:pay-1",
          }),
        }),
      ]);
    },
  );

  it.each(["failed", "canceled"])(
    "fails and records nothing when Stripe's refund is %s",
    async (status) => {
      const t = setup(PAY, created(status));
      const result = await t.service.refundPayment("admin-1", "staff", PAY.id, undefined, [
        "administrator",
      ]);
      expect(result.isErr()).toBe(true);
      expect(t.paymentRefunds.entries).toEqual([]);
      expect(t.addClawback).not.toHaveBeenCalled();
      expect(t.refunded()).toEqual([]);
    },
  );

  it("a pending staff refund that succeeds later is recorded once, as that staff refund, under the same keys", async () => {
    const t = setup(PAY, created("pending"));
    await t.service.refundPayment(
      "admin-1",
      "staff",
      PAY.id,
      undefined,
      ["administrator"],
      "Buyer withdrew",
    );
    const watched = (t.watch.mock.calls[0] as unknown as [{ staffRefund: unknown }[]])[0][0];
    const context = staffRefundContextOf(watched?.staffRefund);
    expect(context).not.toBeNull();
    if (!context) return;

    expect((await t.service.completeDeferredStaffRefund(context, "re_1")).isOk()).toBe(true);
    // The job runs again (or overlaps): the payment is refunded, so nothing more is written.
    expect((await t.service.completeDeferredStaffRefund(context, "re_1")).isOk()).toBe(true);

    expect(t.paymentRefunds.entries).toEqual([
      expect.objectContaining({
        idempotencyKey: "admin_refund:pay-1",
        amountPence: 10_000,
        stripeRefundId: "re_1",
        source: "staff",
      }),
    ]);
    expect(t.addClawback).toHaveBeenCalledTimes(1);
    expect(t.refunded()).toHaveLength(1);
    expect(t.refunded()[0]?.[0]).toMatchObject({
      actorUserId: "admin-1",
      payload: { staffReason: "Buyer withdrew", stripeRefundId: "re_1" },
    });
  });

  it("leaves a refund Stripe reports was already made to the refund webhooks, recording nothing here", async () => {
    const t = setup(PAY, { kind: "already_refunded" });
    const result = await t.service.refundPayment("admin-1", "staff", PAY.id, undefined, [
      "administrator",
    ]);
    expect(result.isOk()).toBe(true);
    expect(t.paymentRefunds.entries).toEqual([]);
    expect(t.refunded()).toEqual([]);
  });
});

describe("PaymentService.refundManualReviewPayment admin clawback", () => {
  const MR: Pay = {
    ...PAY,
    id: "pay-mr",
    amount: "50.00",
    stripeChargeId: "ch_mr",
    status: "requires_manual_review",
  };

  it("creates a seller payout clawback line after manual-review refund", async () => {
    const t = setup(MR, created("succeeded", 5_000));
    const result = await t.service.refundManualReviewPayment(
      "admin-1",
      "staff",
      MR.id,
      ["administrator"],
      "seller archived",
    );
    expect(result.isOk()).toBe(true);
    expect(t.addClawback).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "le-seller",
        paymentId: "pay-mr",
        amount: "-50.00",
        kind: "refund",
      }),
    );
  });

  it("records a manual-review refund Stripe says was already made, since no webhook will", async () => {
    const t = setup(MR, { kind: "already_refunded" });
    const result = await t.service.refundManualReviewPayment(
      "admin-1",
      "staff",
      MR.id,
      ["administrator"],
      "seller archived",
    );
    expect(result.isOk()).toBe(true);
    expect(t.paymentRefunds.entries).toHaveLength(1);
    expect(t.refunded()).toHaveLength(1);
  });

  it("a pending manual-review refund is watched and recorded only when it succeeds", async () => {
    const t = setup(MR, created("pending", 5_000));
    const result = await t.service.refundManualReviewPayment(
      "admin-1",
      "staff",
      MR.id,
      ["administrator"],
      "seller archived",
    );
    expect(result.isOk()).toBe(true);
    expect(t.paymentRefunds.entries).toEqual([]);
    expect(t.watch).toHaveBeenCalledWith([
      expect.objectContaining({
        staffRefund: expect.objectContaining({
          via: "admin_manual_review",
          eventReason: "seller_archived",
          sourceEventId: "admin_manual_review_refund:pay-mr",
        }),
      }),
    ]);
  });
});
