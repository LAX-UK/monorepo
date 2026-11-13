import { describe, expect, it, vi } from "vitest";
import { PaymentCaptureNotAppliedError } from "../../lib/errors.js";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import { PaymentCaptureService } from "./payment-capture.service.js";

function makeTxRunner() {
  return transactionRunnerFromDb({
    transaction: (fn: (tx: unknown) => unknown) => fn({}),
  } as never);
}

function makeCaptureService(deps: {
  payments: Record<string, unknown>;
  stripePayments?: Record<string, unknown> | null;
  xeroPaymentRecorder?: {
    recordStripeCapture: ReturnType<typeof vi.fn>;
    recordRefundCreditNote: ReturnType<typeof vi.fn>;
  } | null;
  checkoutCleanup?: { closeAfterCapture: ReturnType<typeof vi.fn> } | null;
}) {
  return new PaymentCaptureService(
    makeTxRunner(),
    deps.payments as never,
    { findById: vi.fn() } as never,
    { findById: vi.fn() } as never,
    mockDomainEventSink(vi.fn().mockResolvedValue(undefined)) as never,
    null,
    { createPaymentReceived: vi.fn(), createSellerPaymentReceived: vi.fn() } as never,
    null,
    null,
    null,
    deps.xeroPaymentRecorder ?? null,
    (deps.stripePayments ?? null) as never,
    null,
    (deps.checkoutCleanup ?? null) as never,
  );
}

describe("PaymentCaptureService", () => {
  describe("checkout cleanup", () => {
    const pending = {
      id: "pay1",
      lotId: "lot1",
      paidByUserId: null,
      amount: "100.00",
      status: "pending",
      stripeChargeId: "ch_1",
      stripePaymentIntentId: null,
      sellerLegalEntityId: "le_seller",
    };
    const xero = () => ({
      recordStripeCapture: vi.fn().mockResolvedValue({ ok: true }),
      recordRefundCreditNote: vi.fn(),
    });

    it("runs after the receipt and accounting, not before", async () => {
      const order: string[] = [];
      const xeroPaymentRecorder = xero();
      xeroPaymentRecorder.recordStripeCapture.mockImplementation(async () => {
        order.push("accounting");
        return { ok: true };
      });
      const closeAfterCapture = vi.fn(async () => {
        order.push("cleanup");
      });
      const svc = makeCaptureService({
        payments: {
          findById: vi.fn().mockResolvedValue(pending),
          applyCapturedInTransaction: vi.fn().mockResolvedValue(true),
        },
        xeroPaymentRecorder,
        checkoutCleanup: { closeAfterCapture },
      });

      await svc.capture({ paymentId: "pay1", via: "stripe_checkout_webhook" });

      expect(order).toEqual(["accounting", "cleanup"]);
    });

    it("still runs when the receipt or accounting step throws", async () => {
      const xeroPaymentRecorder = xero();
      xeroPaymentRecorder.recordStripeCapture.mockRejectedValue(new Error("xero down"));
      const closeAfterCapture = vi.fn().mockResolvedValue(undefined);
      const svc = makeCaptureService({
        payments: {
          findById: vi.fn().mockResolvedValue(pending),
          applyCapturedInTransaction: vi.fn().mockResolvedValue(true),
        },
        xeroPaymentRecorder,
        checkoutCleanup: { closeAfterCapture },
      });

      await expect(
        svc.capture({ paymentId: "pay1", via: "stripe_checkout_webhook" }),
      ).rejects.toThrow("xero down");

      expect(closeAfterCapture).toHaveBeenCalledOnce();
    });

    it("in the caller's transaction is handed back, not run, until the caller commits", async () => {
      const closeAfterCapture = vi.fn().mockResolvedValue(undefined);
      const svc = makeCaptureService({
        payments: {
          findById: vi.fn().mockResolvedValue(pending),
          applyCapturedInTransaction: vi.fn().mockResolvedValue(true),
        },
        checkoutCleanup: { closeAfterCapture },
      });

      const result = await svc.capture({
        paymentId: "pay1",
        via: "stripe_checkout_webhook",
        stripePaymentIntentId: "pi_1",
        tx: {} as never,
      });

      expect(result.captured).toBe(true);
      expect(closeAfterCapture).not.toHaveBeenCalled();
      await result.afterCommit?.();
      expect(closeAfterCapture).toHaveBeenCalledExactlyOnceWith("pay1", "pi_1");
    });

    it("for a group closes each member's checkouts after commit, keeping its paying intent", async () => {
      const closeAfterCapture = vi.fn().mockResolvedValue(undefined);
      const svc = makeCaptureService({
        payments: {
          findById: vi.fn(async (id: string) => ({ ...pending, id })),
          applyCapturedInTransaction: vi.fn().mockResolvedValue(true),
        },
        checkoutCleanup: { closeAfterCapture },
      });
      const afterCommit: (() => Promise<void>)[] = [];
      for (const paymentId of ["pay1", "pay2", "pay3"]) {
        const captured = await svc.captureInTransaction({
          paymentId,
          via: "stripe_checkout_webhook",
          stripePaymentIntentId: "pi_group",
          tx: {} as never,
          buyerReceipt: "none",
        });
        afterCommit.push(captured.afterCommit);
      }
      expect(closeAfterCapture).not.toHaveBeenCalled();

      for (const run of afterCommit) await run();

      expect(closeAfterCapture.mock.calls).toEqual([
        ["pay1", "pi_group"],
        ["pay2", "pi_group"],
        ["pay3", "pi_group"],
      ]);
    });
  });

  it("closes the invoice's other checkouts once it is captured, keeping the paying intent", async () => {
    const closeAfterCapture = vi.fn().mockResolvedValue(undefined);
    const row = {
      id: "pay1",
      lotId: "lot1",
      paidByUserId: null,
      amount: "100.00",
      status: "pending",
      stripeChargeId: "ch_1",
      stripePaymentIntentId: null,
      sellerLegalEntityId: "le_seller",
    };
    const svc = makeCaptureService({
      payments: {
        findById: vi.fn().mockResolvedValue(row),
        applyCapturedInTransaction: vi.fn().mockResolvedValue(true),
      },
      checkoutCleanup: { closeAfterCapture },
    });

    await svc.capture({
      paymentId: "pay1",
      via: "stripe_checkout_webhook",
      stripePaymentIntentId: "pi_1",
    });

    expect(closeAfterCapture).toHaveBeenCalledExactlyOnceWith("pay1", "pi_1");
  });

  it("does not clean up when nothing was captured", async () => {
    const closeAfterCapture = vi.fn();
    const svc = makeCaptureService({
      payments: { findById: vi.fn().mockResolvedValue({ id: "pay1", status: "captured" }) },
      checkoutCleanup: { closeAfterCapture },
    });
    await svc.capture({ paymentId: "pay1", via: "admin_manual" });
    expect(closeAfterCapture).not.toHaveBeenCalled();
  });

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
      makeTxRunner(),
      payments as never,
      {
        findById: vi.fn().mockResolvedValue({ id: "lot1", sellerLegalEntityId: "le_seller" }),
      } as never,
      { findById: vi.fn().mockResolvedValue({ name: "Buyer", email: "b@test.com" }) } as never,
      mockDomainEventSink(publish) as never,
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
          status: "authorized",
          stripeChargeId: "ch_1",
          stripePaymentIntentId: null,
          sellerLegalEntityId: "le_seller",
        })
        .mockResolvedValueOnce({
          id: "pay1",
          status: "authorized",
        }),
      applyCapturedInTransaction: vi.fn().mockResolvedValue(false),
    };

    const svc = makeCaptureService({ payments });

    await expect(
      svc.capture({ paymentId: "pay1", via: "stripe_checkout_webhook", requireApply: true }),
    ).rejects.toBeInstanceOf(PaymentCaptureNotAppliedError);
  });

  it("captures payment that was in manual review when Stripe succeeded", async () => {
    const applyCapturedInTransaction = vi.fn().mockResolvedValue(true);
    const publish = vi.fn().mockResolvedValue(undefined);
    const payments = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          paidByUserId: "u1",
          amount: "100.00",
          status: "requires_manual_review",
          stripeChargeId: null,
          stripePaymentIntentId: "pi_1",
          sellerLegalEntityId: "le_seller",
        })
        .mockResolvedValueOnce({
          id: "pay1",
          lotId: "lot1",
          paidByUserId: "u1",
          amount: "100.00",
          status: "captured",
          stripeChargeId: "ch_1",
          stripePaymentIntentId: "pi_1",
          sellerLegalEntityId: "le_seller",
        }),
      applyCapturedInTransaction,
    };

    const svc = new PaymentCaptureService(
      makeTxRunner(),
      payments as never,
      { findById: vi.fn() } as never,
      { findById: vi.fn().mockResolvedValue({ name: "Buyer", email: "b@test.com" }) } as never,
      mockDomainEventSink(publish) as never,
      null,
      { createPaymentReceived: vi.fn(), createSellerPaymentReceived: vi.fn() } as never,
      null,
      null,
      null,
      null,
      null,
    );

    const result = await svc.capture({
      paymentId: "pay1",
      via: "stripe_checkout_webhook",
      stripeChargeId: "ch_1",
      stripePaymentIntentId: "pi_1",
      requireApply: true,
    });

    expect(result).toEqual({ captured: true });
    expect(applyCapturedInTransaction).toHaveBeenCalledWith({}, "pay1", {
      stripeChargeId: "ch_1",
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.captured" }),
    );
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
      makeTxRunner(),
      payments as never,
      { findById: vi.fn() } as never,
      { findById: vi.fn() } as never,
      mockDomainEventSink(vi.fn()) as never,
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
      revokeOpenCheckoutForPayment: vi.fn().mockResolvedValue(undefined),
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

  describe("the payment intent on the captured row", () => {
    const row = (stripePaymentIntentId: string | null) => ({
      id: "pay1",
      lotId: "lot1",
      paidByUserId: "u1",
      amount: "100.00",
      status: "pending",
      stripeChargeId: null,
      stripePaymentIntentId,
      sellerLegalEntityId: "le_seller",
    });

    it("stores the intent of a card checkout whose row has none, with the charge", async () => {
      const applyCapturedInTransaction = vi.fn().mockResolvedValue(true);
      const svc = makeCaptureService({
        payments: { findById: vi.fn().mockResolvedValue(row(null)), applyCapturedInTransaction },
      });
      await svc.capture({
        paymentId: "pay1",
        via: "stripe_checkout_webhook",
        stripeChargeId: "ch_card",
        stripePaymentIntentId: "pi_card",
      });
      expect(applyCapturedInTransaction).toHaveBeenCalledWith({}, "pay1", {
        stripeChargeId: "ch_card",
        stripePaymentIntentId: "pi_card",
      });
    });

    it("keeps an intent already on the row", async () => {
      const applyCapturedInTransaction = vi.fn().mockResolvedValue(true);
      const svc = makeCaptureService({
        payments: {
          findById: vi.fn().mockResolvedValue(row("pi_recorded")),
          applyCapturedInTransaction,
        },
      });
      await svc.capture({
        paymentId: "pay1",
        via: "stripe_checkout_webhook",
        stripeChargeId: "ch_card",
        stripePaymentIntentId: "pi_other",
      });
      expect(applyCapturedInTransaction).toHaveBeenCalledWith({}, "pay1", {
        stripeChargeId: "ch_card",
      });
    });

    it("stores no intent when none is known (a capture by staff)", async () => {
      const applyCapturedInTransaction = vi.fn().mockResolvedValue(true);
      const svc = makeCaptureService({
        payments: { findById: vi.fn().mockResolvedValue(row(null)), applyCapturedInTransaction },
      });
      await svc.capture({ paymentId: "pay1", via: "admin_manual", stripeChargeId: "ch_card" });
      expect(applyCapturedInTransaction).toHaveBeenCalledWith({}, "pay1", {
        stripeChargeId: "ch_card",
      });
    });
  });
});
