import { describe, expect, it } from "vitest";
import { type CheckoutIntroInput, checkoutIntro } from "./checkout-intro";

const due: CheckoutIntroInput = {
  organisationName: null,
  paymentComplete: false,
  openPaymentStatus: null,
  openPaymentReviewReason: null,
  complianceGate: "clear",
};

describe("checkoutIntro", () => {
  it("asks to pay only when the purchase is due", () => {
    expect(checkoutIntro(due)).toBe(
      "Confirm the delivery address and pay by card or UK bank transfer.",
    );
    expect(checkoutIntro({ ...due, organisationName: "Northbank Gallery" })).toContain(
      "pay for Northbank Gallery",
    );
  });

  it("never says the invoice is ready while source-of-funds checks are pending", () => {
    for (const input of [
      { ...due, complianceGate: "source_of_funds_required" as const },
      {
        ...due,
        openPaymentStatus: "pending" as const,
        openPaymentReviewReason: "aml_hold" as const,
      },
      { ...due, openPaymentStatus: "requires_manual_review" as const },
    ]) {
      const intro = checkoutIntro(input);
      expect(intro).toMatch(/^We need to complete some checks/);
      expect(intro).not.toMatch(/invoice is ready|pay by card/);
    }
  });

  it("follows the payment once it is under way or done", () => {
    expect(checkoutIntro({ ...due, openPaymentStatus: "authorized" })).toMatch(/being processed/);
    expect(checkoutIntro({ ...due, paymentComplete: true })).toMatch(/is paid/);
  });
});
