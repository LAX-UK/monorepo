import { describe, expect, it, vi } from "vitest";
import { PaymentCaptureNotAppliedError } from "../../lib/errors.js";
import { PaymentCaptureService } from "./payment-capture.service.js";

function makeCaptureService(deps: {
  payments: Record<string, unknown>;
  stripePayments?: Record<string, unknown> | null;
  xeroPaymentRecorder?: {
    recordStripeCapture: ReturnType<typeof vi.fn>;
    recordRefundCreditNote: ReturnType<typeof vi.fn>;
  } | null;
}) {
  return new PaymentCaptureService(
    { transaction: (fn: (tx: unknown) => unknown) => fn({}) } as never,
    deps.payments as never,
    { findById: vi.fn() } as never,
    { findById: vi.fn() } as never,
    { publish: vi.fn().mockResolvedValue(undefined) } as never,
    null,
    { createPaymentReceived: vi.fn(), createSellerPaymentReceived: vi.fn() } as never,
    null,
    null,
    null,
    deps.xeroPaymentRecorder ?? null,
    (deps.stripePayments ?? null) as never,
  );
}

describe("PaymentCaptureService", () => {
  it("publishes payment.captured and invokes fulfilment hooks", async () => {
    const applyCapturedInTransaction = vi.fn().mockResolvedValue(true);
    const publish = vi.fn().mockResolvedValue(undefined);
    const onPaymentCaptured = vi.fn().mockResolvedValue(undefined);

    const payments = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          paidByUserId: "u1",
          amount: "100.00",
          status: "pending",
          stripeChargeId: null,
          stripePaymentIntentId: null,
          sellerLegalEntityId: "le_seller",
        })
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          paidByUserId: "u1",
          amount: "100.00",
          status: "captured",
          stripeChargeId: "ch_1",
          stripePaymentIntentId: null,
          sellerLegalEntityId: "le_seller",
        }),
      applyCapturedInTransaction,
    };

    const svc = new PaymentCaptureService(
      { transaction: (fn: (tx: unknown) => unknown) => fn({}) } as never,
      payments as never,
      {
        findById: vi.fn().mockResolvedValue({ id: "lot1", sellerLegalEntityId: "le_seller" }),
      } as never,
      { findById: vi.fn().mockResolvedValue({ name: "Buyer", email: "b@test.com" }) } as never,
      { publish } as never,
      null,
      { createPaymentReceived: vi.fn(), createSellerPaymentReceived: vi.fn() } as never,
      null,
      { onPaymentCaptured, ensureAwaitingPayment: vi.fn() } as never,
      null,
      null,
      null,
    );

    await svc.capture({
      paymentId: "pay1",
      via: "stripe_checkout_webhook",
      stripeChargeId: "ch_1",
    });

    expect(applyCapturedInTransaction).toHaveBeenCalledWith({}, "pay1", {
      stripeChargeId: "ch_1",
    });
    expect(publish).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventType: "payment.captured" }),
    );
    expect(onPaymentCaptured).toHaveBeenCalledWith("lot1", "pay1");
  });

  it("throws when requireApply is set and capture guard does not apply", async () => {
    const payments = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          paidByUserId: "u1",
          amount: "100.00",
          status: "requires_manual_review",
          stripeChargeId: "ch_1",
          stripePaymentIntentId: null,
          sellerLegalEntityId: "le_seller",
        })
        .mockResolvedValueOnce({
          id: "pay1",
          status: "requires_manual_review",
        }),
      applyCapturedInTransaction: vi.fn().mockResolvedValue(false),
    };

    const svc = makeCaptureService({ payments });

    await expect(
      svc.capture({ paymentId: "pay1", via: "stripe_checkout_webhook", requireApply: true }),
    ).rejects.toBeInstanceOf(PaymentCaptureNotAppliedError);
  });

  it("returns captured false without throwing when requireApply and payment already captured", async () => {
    const payments = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          paidByUserId: "u1",
          amount: "100.00",
          status: "pending",
          stripeChargeId: "ch_1",
          stripePaymentIntentId: "pi_1",
          sellerLegalEntityId: "le_seller",
        })
        .mockResolvedValueOnce({
          id: "pay1",
          status: "captured",
        }),
      applyCapturedInTransaction: vi.fn().mockResolvedValue(false),
    };

    const svc = makeCaptureService({ payments });
    const result = await svc.capture({
      paymentId: "pay1",
      via: "stripe_checkout_webhook",
      requireApply: true,
    });
    expect(result).toEqual({ captured: false });
  });

  it("records Xero payment on admin_manual capture", async () => {
    const recordStripeCapture = vi.fn().mockResolvedValue({ ok: true });
    const payments = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          paidByUserId: "u1",
          amount: "250.00",
          status: "pending",
          stripeChargeId: null,
          stripePaymentIntentId: null,
          sellerLegalEntityId: "le_seller",
        })
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          amount: "250.00",
          status: "captured",
          stripeChargeId: null,
          stripePaymentIntentId: null,
          sellerLegalEntityId: "le_seller",
        }),
      applyCapturedInTransaction: vi.fn().mockResolvedValue(true),
    };

    const svc = new PaymentCaptureService(
      { transaction: (fn: (tx: unknown) => unknown) => fn({}) } as never,
      payments as never,
      { findById: vi.fn() } as never,
      { findById: vi.fn() } as never,
      { publish: vi.fn() } as never,
      null,
      { createPaymentReceived: vi.fn(), createSellerPaymentReceived: vi.fn() } as never,
      null,
      null,
      null,
      { recordStripeCapture, recordRefundCreditNote: vi.fn() },
      null,
    );

    await svc.capture({ paymentId: "pay1", via: "admin_manual", actorUserId: "admin-1" });
    expect(recordStripeCapture).toHaveBeenCalledWith("pay1", "250.00");
  });

  it("backfills stripeChargeId from PaymentIntent when webhook omits latest_charge", async () => {
    const applyCapturedInTransaction = vi.fn().mockResolvedValue(true);
    const payments = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          paidByUserId: "u1",
          amount: "100.00",
          status: "authorized",
          stripeChargeId: null,
          stripePaymentIntentId: "pi_1",
          sellerLegalEntityId: "le_seller",
        })
        .mockResolvedValueOnce({
          id: "pay1",
          amount: "100.00",
          status: "captured",
          stripeChargeId: "ch_from_pi",
          stripePaymentIntentId: "pi_1",
          sellerLegalEntityId: "le_seller",
        }),
      applyCapturedInTransaction,
    };
    const stripePayments = {
      isConfigured: () => true,
      retrievePaymentIntent: vi.fn().mockResolvedValue({
        id: "pi_1",
        latest_charge: "ch_from_pi",
      }),
      findChargeIdForPayment: vi.fn(),
    };

    const svc = makeCaptureService({ payments, stripePayments });
    await svc.capture({
      paymentId: "pay1",
      via: "stripe_checkout_webhook",
      stripePaymentIntentId: "pi_1",
    });

    expect(applyCapturedInTransaction).toHaveBeenCalledWith({}, "pay1", {
      stripeChargeId: "ch_from_pi",
    });
  });
});
