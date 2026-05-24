import { describe, expect, it, vi } from "vitest";
import { PaymentCaptureNotAppliedError } from "../../lib/errors.js";
import { PaymentCaptureService } from "./payment-capture.service.js";

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
      { onPaymentCaptured } as never,
      null,
      null,
      null,
    );

    await svc.capture({ paymentId: "pay1", via: "xero_sync", stripeChargeId: "ch_1" });

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
      null,
      null,
    );

    await expect(
      svc.capture({ paymentId: "pay1", via: "stripe_checkout_webhook", requireApply: true }),
    ).rejects.toBeInstanceOf(PaymentCaptureNotAppliedError);
  });
});
