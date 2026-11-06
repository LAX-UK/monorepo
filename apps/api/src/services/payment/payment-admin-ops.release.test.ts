import { describe, expect, it, vi } from "vitest";
import { releaseManualReviewForCapture } from "./payment-admin-ops.js";
import type { PaymentServiceDeps } from "./payment-service-types.js";

const reviewed = {
  id: "pay-1",
  lotId: "lot-1",
  amount: "100.00",
  status: "requires_manual_review",
  buyerId: "buyer-1",
  sellerLegalEntityId: "le-s",
};

function depsFor(row: Record<string, unknown>, extendAfterHold = vi.fn().mockResolvedValue(true)) {
  const capture = vi.fn().mockResolvedValue({ captured: true });
  const applyReleasedFromManualReviewInTransaction = vi.fn().mockResolvedValue(true);
  const deps = {
    payments: {
      findById: vi.fn().mockResolvedValue(row),
      applyReleasedFromManualReviewInTransaction,
      updateStatus: vi.fn(),
    },
    settlementCompliance: null,
    paymentCapture: { capture },
    transactionRunner: { runInTransaction: async (fn: (tx: never) => unknown) => fn({} as never) },
    domainEventSink: { withTx: () => ({ publish: vi.fn() }), publish: vi.fn() },
    invoiceDueDates: { extendAfterHold },
  } as unknown as PaymentServiceDeps;
  return { deps, capture, applyReleasedFromManualReviewInTransaction, extendAfterHold };
}

describe("releaseManualReviewForCapture", () => {
  it("captures money that arrived while the account was held, instead of asking for it again", async () => {
    const { deps, capture, applyReleasedFromManualReviewInTransaction } = depsFor({
      ...reviewed,
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
    });
    const result = await releaseManualReviewForCapture(deps, "finance-1", "staff", "pay-1", [
      "finance",
    ]);
    expect(result.isOk()).toBe(true);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay-1",
        via: "admin_manual",
        stripePaymentIntentId: "pi_1",
        stripeChargeId: "ch_1",
        requireApply: true,
      }),
    );
    expect(applyReleasedFromManualReviewInTransaction).not.toHaveBeenCalled();
  });

  it("with no money taken, releases the invoice so the buyer can pay", async () => {
    const { deps, capture, applyReleasedFromManualReviewInTransaction } = depsFor(reviewed);
    await releaseManualReviewForCapture(deps, "finance-1", "staff", "pay-1", ["finance"]);
    expect(capture).not.toHaveBeenCalled();
    expect(applyReleasedFromManualReviewInTransaction).toHaveBeenCalled();
  });

  it("moves the invoice's due date to the term counted from the release", async () => {
    const { deps, extendAfterHold } = depsFor({ ...reviewed, invoiceId: "inv-1" });
    await releaseManualReviewForCapture(deps, "finance-1", "staff", "pay-1", ["finance"]);
    expect(extendAfterHold).toHaveBeenCalledWith("inv-1", expect.any(Date));
  });

  it("leaves the due date alone when money was already taken and is captured instead", async () => {
    const { deps, extendAfterHold } = depsFor({
      ...reviewed,
      invoiceId: "inv-1",
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
    });
    await releaseManualReviewForCapture(deps, "finance-1", "staff", "pay-1", ["finance"]);
    expect(extendAfterHold).not.toHaveBeenCalled();
  });

  it("still releases the invoice when the due date could not be moved", async () => {
    const { deps, applyReleasedFromManualReviewInTransaction } = depsFor(
      { ...reviewed, invoiceId: "inv-1" },
      vi.fn().mockRejectedValue(new Error("db down")),
    );
    const result = await releaseManualReviewForCapture(deps, "finance-1", "staff", "pay-1", [
      "finance",
    ]);
    expect(result.isOk()).toBe(true);
    expect(applyReleasedFromManualReviewInTransaction).toHaveBeenCalled();
  });
});
