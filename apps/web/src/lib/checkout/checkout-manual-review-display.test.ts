import { describe, expect, it } from "vitest";
import { resolveCheckoutManualReviewDisplayReason } from "./checkout-payment-errors";

describe("resolveCheckoutManualReviewDisplayReason", () => {
  it("defaults requires_manual_review without reason to finance release", () => {
    expect(
      resolveCheckoutManualReviewDisplayReason({
        submitted: false,
        submittedReviewReason: null,
        openPaymentStatus: "requires_manual_review",
        openPaymentManualReviewReason: null,
        preflightComplianceGate: "clear",
      }),
    ).toBe("finance_release_required");
  });

  it("prefers submitted review reason after checkout attempt", () => {
    expect(
      resolveCheckoutManualReviewDisplayReason({
        submitted: true,
        submittedReviewReason: "source_of_funds_required",
        openPaymentStatus: "requires_manual_review",
        openPaymentManualReviewReason: null,
        preflightComplianceGate: "clear",
      }),
    ).toBe("source_of_funds_required");
  });
});
