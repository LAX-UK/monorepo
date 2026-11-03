import type { BlockedCapture, PaymentRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { refundBlockedCapture, reinstateBlockedCapture } from "./payment-blocked-capture-ops.js";

const FINANCE = ["finance"] as never;

const blocked: BlockedCapture = {
  paymentId: "pay-1",
  stripePaymentIntentId: "pi_1",
  stripeChargeId: "ch_1",
  amountCents: 125_000,
  blockedAt: new Date("2026-11-02T10:00:00Z"),
};

function payment(over: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay-1",
    lotId: "lot-1",
    amount: "1250.00",
    platformFee: "0.00",
    stripePaymentIntentId: "pi_1",
    stripeChargeId: null,
    stripeRefundId: null,
    status: "cancelled",
    createdAt: new Date("2026-10-20T10:00:00Z"),
    sellerLegalEntityId: "seller-1",
    ...over,
  };
}

function setup(
  over: { payment?: PaymentRecord | null; blocked?: BlockedCapture | null; voided?: boolean } = {},
) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const payments = {
    findById: vi.fn().mockResolvedValue("payment" in over ? over.payment : payment()),
    findBlockedCapture: vi.fn().mockResolvedValue("blocked" in over ? over.blocked : blocked),
    isVoidedByBuyerDefault: vi.fn().mockResolvedValue(over.voided === true),
    applyReopenedFromCancelledInTransaction: vi.fn().mockResolvedValue(true),
    applyRefundedFromCancelledInTransaction: vi.fn().mockResolvedValue(true),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
  const paymentCapture = { capture: vi.fn().mockResolvedValue({ captured: true }) };
  const stripePayments = {
    isConfigured: () => true,
    createRefund: vi.fn().mockResolvedValue({ kind: "created", refundId: "re_1" }),
  };
  const deps = {
    payments,
    paymentCapture,
    stripePayments,
    transactionRunner: { runInTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
    domainEventSink: { withTx: () => ({ publish }) },
  } as never;
  return { deps, payments, paymentCapture, stripePayments, publish };
}

describe("reinstateBlockedCapture", () => {
  it("refuses anyone without finance write access", async () => {
    const { deps, payments } = setup();
    const result = await reinstateBlockedCapture(deps, "admin-1", "staff", "pay-1", [
      "client_services",
    ] as never);
    expect(result._unsafeUnwrapErr().status).toBe(403);
    expect(payments.findById).not.toHaveBeenCalled();
  });

  it("reopens the cancelled payment and records the capture Stripe already took", async () => {
    const { deps, payments, paymentCapture } = setup();
    const result = await reinstateBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE);
    expect(result.isOk()).toBe(true);
    expect(payments.applyReopenedFromCancelledInTransaction).toHaveBeenCalledOnce();
    expect(paymentCapture.capture).toHaveBeenCalledWith({
      paymentId: "pay-1",
      via: "admin_manual",
      stripeChargeId: "ch_1",
      stripePaymentIntentId: "pi_1",
      actorUserId: "admin-1",
      requireApply: true,
    });
  });

  it("never reinstates a payment whose sale a buyer default cancelled", async () => {
    const { deps, payments, paymentCapture } = setup({ voided: true });
    const result = await reinstateBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE);
    expect(result._unsafeUnwrapErr().message).toContain("Refund the payment instead");
    expect(payments.applyReopenedFromCancelledInTransaction).not.toHaveBeenCalled();
    expect(paymentCapture.capture).not.toHaveBeenCalled();
  });

  it("does nothing when the payment is already captured", async () => {
    const { deps, paymentCapture } = setup({ payment: payment({ status: "captured" }) });
    const result = await reinstateBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE);
    expect(result.isOk()).toBe(true);
    expect(paymentCapture.capture).not.toHaveBeenCalled();
  });

  it.each(["pending", "refunded", "requires_manual_review"] as const)(
    "refuses a %s payment: it is not closed",
    async (status) => {
      const { deps } = setup({ payment: payment({ status }) });
      const result = await reinstateBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE);
      expect(result._unsafeUnwrapErr().status).toBe(409);
    },
  );

  it("refuses a cancelled payment Stripe never took money for", async () => {
    const { deps, payments } = setup({ blocked: null });
    const result = await reinstateBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE);
    expect(result._unsafeUnwrapErr().status).toBe(409);
    expect(payments.applyReopenedFromCancelledInTransaction).not.toHaveBeenCalled();
  });

  it("points to a refund when the buyer already started a newer payment for the lot", async () => {
    const { deps, payments, paymentCapture } = setup();
    payments.applyReopenedFromCancelledInTransaction.mockRejectedValue({ code: "23505" });
    const result = await reinstateBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE);
    const error = result._unsafeUnwrapErr();
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/Refund this one instead/);
    expect(paymentCapture.capture).not.toHaveBeenCalled();
  });

  it("puts the payment back as cancelled when recording the capture fails", async () => {
    const { deps, payments, paymentCapture } = setup();
    paymentCapture.capture.mockRejectedValue(new Error("not applied"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await reinstateBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE);
    expect(result._unsafeUnwrapErr().status).toBe(500);
    expect(payments.updateStatus).toHaveBeenCalledWith("pay-1", "cancelled");
    log.mockRestore();
  });
});

describe("refundBlockedCapture", () => {
  it("refuses anyone without finance write access", async () => {
    const { deps, stripePayments } = setup();
    const result = await refundBlockedCapture(
      deps,
      "admin-1",
      "staff",
      "pay-1",
      ["client_services"] as never,
      "Buyer paid twice",
    );
    expect(result._unsafeUnwrapErr().status).toBe(403);
    expect(stripePayments.createRefund).not.toHaveBeenCalled();
  });

  it("refunds the charge Stripe took and marks the payment refunded with the reason", async () => {
    const { deps, payments, stripePayments, publish } = setup();
    const result = await refundBlockedCapture(
      deps,
      "admin-1",
      "staff",
      "pay-1",
      FINANCE,
      "Checkout closed before payment arrived",
    );
    expect(result.isOk()).toBe(true);
    expect(stripePayments.createRefund).toHaveBeenCalledWith({
      chargeId: "ch_1",
      amount: 125_000,
      reason: "requested_by_customer",
      paymentId: "pay-1",
    });
    expect(payments.applyRefundedFromCancelledInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      "pay-1",
      "re_1",
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.refunded",
        actorUserId: "admin-1",
        payload: expect.objectContaining({
          stripeRefundId: "re_1",
          staffReason: "Checkout closed before payment arrived",
        }),
      }),
    );
  });

  it("does not refund twice", async () => {
    const { deps, stripePayments } = setup({ payment: payment({ status: "refunded" }) });
    const result = await refundBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE, "x");
    expect(result.isOk()).toBe(true);
    expect(stripePayments.createRefund).not.toHaveBeenCalled();
  });

  it("refuses a payment that is not closed, or that took no money", async () => {
    const open = setup({ payment: payment({ status: "pending" }) });
    expect(
      (
        await refundBlockedCapture(open.deps, "admin-1", "staff", "pay-1", FINANCE, "x")
      )._unsafeUnwrapErr().status,
    ).toBe(409);
    const none = setup({ blocked: null });
    expect(
      (
        await refundBlockedCapture(none.deps, "admin-1", "staff", "pay-1", FINANCE, "x")
      )._unsafeUnwrapErr().status,
    ).toBe(409);
    expect(none.stripePayments.createRefund).not.toHaveBeenCalled();
  });

  it("cannot refund without a recorded charge", async () => {
    const { deps, stripePayments } = setup({
      blocked: { ...blocked, stripeChargeId: null },
      payment: payment({ stripeChargeId: null }),
    });
    const result = await refundBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE, "x");
    expect(result._unsafeUnwrapErr().status).toBe(400);
    expect(stripePayments.createRefund).not.toHaveBeenCalled();
  });

  it("reports a ledger failure after Stripe refunded, so finance can reconcile", async () => {
    const { deps, payments } = setup();
    payments.applyRefundedFromCancelledInTransaction.mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await refundBlockedCapture(deps, "admin-1", "staff", "pay-1", FINANCE, "x");
    expect(result._unsafeUnwrapErr().message).toMatch(/Reconcile manually/);
    log.mockRestore();
  });
});
