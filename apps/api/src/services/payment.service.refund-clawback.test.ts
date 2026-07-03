import { describe, expect, it, vi } from "vitest";
import { transactionRunnerFromDb } from "../test/transaction-runner-from-db.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import { PaymentService } from "./payment.service.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment/payment-tier.policy.js";

const defaultTierPolicy = new PaymentTierPolicy(
  parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: 100_000,
    STRIPE_MANUAL_REVIEW_MIN: 500_000,
    STRIPE_ABSOLUTE_MAX: 999_999.99,
  }),
);

describe("PaymentService.refundPayment admin clawback", () => {
  it("creates a seller payout clawback line after a successful Stripe refund", async () => {
    const tx = {} as never;
    const db = {
      transaction: vi.fn(async (fn: (t: never) => Promise<void>) => fn(tx)),
    };
    const pay = {
      id: "pay-1",
      lotId: "lot-1",
      buyerId: "buyer-1",
      amount: "100.00",
      sellerLegalEntityId: "le-seller",
      stripeChargeId: "ch_1",
      status: "captured" as const,
    };
    const addClawback = vi.fn().mockResolvedValue(undefined);
    const payoutAdjustments = {
      addPaymentLineToOpenPayoutOrCreateClawback: addClawback,
    } as unknown as IPayoutAdjustmentService;
    const service = new PaymentService(
      { findById: vi.fn() } as never,
      {
        findById: vi.fn().mockResolvedValue(pay),
        applyRefundedInTransaction: vi.fn().mockResolvedValue(true),
      } as never,
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
      { publish: vi.fn().mockResolvedValue(undefined) } as never,
      {
        isConfigured: () => true,
        capturePaymentIntent: vi.fn(),
        createRefund: vi.fn().mockResolvedValue({ kind: "created", refundId: "re_1" }),
        createCardCheckoutSession: vi.fn(),
        createBankTransferCheckoutSession: vi.fn(),
        retrievePaymentIntent: vi.fn(),
        retrieveCheckoutSession: vi.fn(),
        findChargeIdForPayment: vi.fn(),
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
    );

    const result = await service.refundPayment(
      "admin-1",
      "staff",
      pay.id,
      undefined,
      "super_admin",
    );

    expect(result.isOk()).toBe(true);
    expect(addClawback).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "le-seller",
        paymentId: "pay-1",
        amount: "-100.00",
        kind: "refund",
      }),
    );
  });
});

describe("PaymentService.refundManualReviewPayment admin clawback", () => {
  it("creates a seller payout clawback line after manual-review refund", async () => {
    const tx = {} as never;
    const db = {
      transaction: vi.fn(async (fn: (t: never) => Promise<void>) => fn(tx)),
    };
    const pay = {
      id: "pay-mr",
      lotId: "lot-1",
      buyerId: "buyer-1",
      amount: "50.00",
      sellerLegalEntityId: "le-seller",
      stripeChargeId: "ch_mr",
      status: "requires_manual_review" as const,
    };
    const addClawback = vi.fn().mockResolvedValue(undefined);
    const payoutAdjustments = {
      addPaymentLineToOpenPayoutOrCreateClawback: addClawback,
    } as unknown as IPayoutAdjustmentService;
    const service = new PaymentService(
      { findById: vi.fn() } as never,
      {
        findById: vi.fn().mockResolvedValue(pay),
        applyRefundedInTransaction: vi.fn().mockResolvedValue(true),
      } as never,
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
      { publish: vi.fn().mockResolvedValue(undefined) } as never,
      {
        isConfigured: () => true,
        capturePaymentIntent: vi.fn(),
        createRefund: vi.fn().mockResolvedValue({ kind: "created", refundId: "re_mr" }),
        createCardCheckoutSession: vi.fn(),
        createBankTransferCheckoutSession: vi.fn(),
        retrievePaymentIntent: vi.fn(),
        retrieveCheckoutSession: vi.fn(),
        findChargeIdForPayment: vi.fn(),
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
    );

    const result = await service.refundManualReviewPayment(
      "admin-1",
      "staff",
      pay.id,
      "super_admin",
    );

    expect(result.isOk()).toBe(true);
    expect(addClawback).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "le-seller",
        paymentId: "pay-mr",
        amount: "-50.00",
        kind: "refund",
      }),
    );
  });
});
