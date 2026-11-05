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

function depsFor(row: Record<string, unknown>) {
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
  } as unknown as PaymentServiceDeps;
  return { deps, capture, applyReleasedFromManualReviewInTransaction };
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
});
