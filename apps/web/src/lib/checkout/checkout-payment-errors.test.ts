import { describe, expect, it } from "vitest";
import { checkoutPaymentErrorMessage, manualReviewReasonCopy } from "./checkout-payment-errors";

describe("checkoutPaymentErrorMessage", () => {
  it("maps known API codes", () => {
    expect(checkoutPaymentErrorMessage("x", "payment_amount_exceeds_limit")).toContain("limit");
    expect(checkoutPaymentErrorMessage("x", "stripe_checkout_already_complete")).toBe(
      "Checkout is already complete. Payment confirmation may take a few minutes, so refresh this page.",
    );
  });

  it("falls back to server message", () => {
    expect(checkoutPaymentErrorMessage("Custom")).toBe("Custom");
  });

  it("maps compliance checkout block codes", () => {
    expect(checkoutPaymentErrorMessage("x", "payment_checkout_blocked_aml_hold")).toContain(
      "compliance",
    );
    expect(checkoutPaymentErrorMessage("x", "payment_checkout_blocked_source_of_funds")).toContain(
      "source-of-funds",
    );
  });

  it("maps accounting and session codes", () => {
    expect(checkoutPaymentErrorMessage("x", "accounting_unavailable")).toContain("invoice");
    expect(checkoutPaymentErrorMessage("x", "session_required")).toContain("session expired");
  });
});

describe("manualReviewReasonCopy", () => {
  it("never names a vendor or an internal review", () => {
    const reasons = [
      "seller_archived",
      "high_value",
      "seller_archived_and_high_value",
      "aml_hold",
      "source_of_funds_required",
      "finance_release_required",
      null,
    ] as const;
    for (const reason of reasons) {
      expect(manualReviewReasonCopy(reason)).not.toMatch(/stripe|finance review/i);
    }
  });

  it("describes high value review", () => {
    expect(manualReviewReasonCopy("high_value")).toContain("Our team checks");
  });

  it("describes finance release after compliance clears", () => {
    expect(manualReviewReasonCopy("finance_release_required")).toContain("checks your invoice");
  });
});
