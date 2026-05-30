import { describe, expect, it } from "vitest";
import { checkoutPaymentErrorMessage, manualReviewReasonCopy } from "./checkout-payment-errors";

describe("checkoutPaymentErrorMessage", () => {
  it("maps known API codes", () => {
    expect(checkoutPaymentErrorMessage("x", "payment_amount_exceeds_limit")).toContain("limit");
    expect(checkoutPaymentErrorMessage("x", "stripe_checkout_already_complete")).toContain(
      "Stripe",
    );
  });

  it("falls back to server message", () => {
    expect(checkoutPaymentErrorMessage("Custom")).toBe("Custom");
  });
});

describe("manualReviewReasonCopy", () => {
  it("describes high value review", () => {
    expect(manualReviewReasonCopy("high_value")).toContain("finance review");
  });
});
