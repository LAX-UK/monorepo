import { describe, expect, it } from "vitest";
import {
  type ResolveCheckoutViewInput,
  checkoutViewShowsOrderSummary,
  resolveCheckoutView,
} from "./checkout-page-state";

const baseInput = (): ResolveCheckoutViewInput => ({
  paymentComplete: false,
  paymentsLoadFailed: false,
  bankTransferInstructions: false,
  awaitingCaptureConfirmation: false,
  redirectFailed: false,
  pendingCheckoutUrl: null,
  redirectingToStripe: false,
  showManualReview: null,
  openPaymentStatus: null,
});

describe("resolveCheckoutView", () => {
  it("paymentComplete beats awaitingCaptureConfirmation", () => {
    expect(
      resolveCheckoutView({
        ...baseInput(),
        paymentComplete: true,
        awaitingCaptureConfirmation: true,
      }),
    ).toEqual({ kind: "complete" });
  });

  it("bankTransfer beats confirming when both flags are set", () => {
    expect(
      resolveCheckoutView({
        ...baseInput(),
        bankTransferInstructions: true,
        awaitingCaptureConfirmation: true,
      }),
    ).toEqual({ kind: "bankTransfer" });
  });

  it("redirectFailed beats redirecting when both are true", () => {
    expect(
      resolveCheckoutView({
        ...baseInput(),
        redirectFailed: true,
        pendingCheckoutUrl: "https://checkout.stripe.com/test",
        redirectingToStripe: true,
      }),
    ).toEqual({ kind: "redirectFailed" });
  });

  it("redirectFailed requires pendingCheckoutUrl", () => {
    expect(
      resolveCheckoutView({
        ...baseInput(),
        redirectFailed: true,
        redirectingToStripe: true,
      }),
    ).toEqual({ kind: "redirecting" });
  });

  it("manual review sub-view when showManualReview is set", () => {
    expect(
      resolveCheckoutView({
        ...baseInput(),
        showManualReview: "aml_hold",
      }),
    ).toEqual({ kind: "purchase", sub: "manualReview", manualReviewReason: "aml_hold" });
  });

  it("in-flight sub-view when payment is authorized", () => {
    expect(
      resolveCheckoutView({
        ...baseInput(),
        openPaymentStatus: "authorized",
      }),
    ).toEqual({ kind: "purchase", sub: "inFlight", manualReviewReason: null });
  });

  it("defaults to purchase form", () => {
    expect(resolveCheckoutView(baseInput())).toEqual({
      kind: "purchase",
      sub: "form",
      manualReviewReason: null,
    });
  });
});

describe("checkoutViewShowsOrderSummary", () => {
  it("hides order summary on complete and redirecting", () => {
    expect(checkoutViewShowsOrderSummary({ kind: "complete" })).toBe(false);
    expect(checkoutViewShowsOrderSummary({ kind: "redirecting" })).toBe(false);
  });

  it("shows order summary on other views", () => {
    expect(checkoutViewShowsOrderSummary({ kind: "confirming" })).toBe(true);
    expect(checkoutViewShowsOrderSummary({ kind: "redirectFailed" })).toBe(true);
    expect(
      checkoutViewShowsOrderSummary({
        kind: "purchase",
        sub: "form",
        manualReviewReason: null,
      }),
    ).toBe(true);
  });
});
