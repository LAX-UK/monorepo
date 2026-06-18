import { describe, expect, it } from "vitest";
import {
  isAwaitingCaptureConfirmation,
  resolveCheckoutPagePaymentState,
} from "./checkout-page-state";

describe("resolveCheckoutPagePaymentState", () => {
  it("marks complete when payment is captured", () => {
    const state = resolveCheckoutPagePaymentState(
      [
        {
          id: "p1",
          lotId: "lot-1",
          lotTitle: "Lot",
          lotImageUrl: null,
          amount: "100",
          platformFee: "5",
          currency: "GBP",
          status: "captured",
          createdAt: new Date().toISOString(),
          invoiceUrl: null,
          invoiceNumber: null,
          checkoutRail: null,
          manualReviewReason: null,
        },
      ],
      "lot-1",
      { id: "f1", lotId: "lot-1", status: "awaiting_payment", paymentId: "p1" } as never,
    );
    expect(state.paymentComplete).toBe(true);
    expect(state.openPayment).toBeNull();
  });

  it("marks complete when fulfilment is post-payment", () => {
    const state = resolveCheckoutPagePaymentState([], "lot-1", {
      id: "f1",
      lotId: "lot-1",
      status: "awaiting_release",
      paymentId: "p1",
    } as never);
    expect(state.paymentComplete).toBe(true);
  });

  it("keeps an authorized bank transfer as an open (in-flight) payment, not complete", () => {
    const state = resolveCheckoutPagePaymentState(
      [
        {
          id: "p1",
          lotId: "lot-1",
          lotTitle: "Lot",
          lotImageUrl: null,
          amount: "15000",
          platformFee: "750",
          currency: "GBP",
          status: "authorized",
          createdAt: new Date().toISOString(),
          invoiceUrl: null,
          invoiceNumber: null,
          checkoutRail: "gb_bank_transfer",
          manualReviewReason: null,
        },
      ],
      "lot-1",
      { id: "f1", lotId: "lot-1", status: "awaiting_payment", paymentId: "p1" } as never,
    );
    expect(state.paymentComplete).toBe(false);
    expect(state.openPayment?.status).toBe("authorized");
  });
});

describe("isAwaitingCaptureConfirmation", () => {
  it("is true after Stripe success return while payment is still pending", () => {
    expect(
      isAwaitingCaptureConfirmation({
        stripeReturnSuccess: true,
        paymentComplete: false,
        openPaymentStatus: "pending",
      }),
    ).toBe(true);
  });

  it("is false once payment is captured", () => {
    expect(
      isAwaitingCaptureConfirmation({
        stripeReturnSuccess: true,
        paymentComplete: true,
        openPaymentStatus: null,
      }),
    ).toBe(false);
  });

  it("is false without Stripe success return", () => {
    expect(
      isAwaitingCaptureConfirmation({
        stripeReturnSuccess: false,
        paymentComplete: false,
        openPaymentStatus: "pending",
      }),
    ).toBe(false);
  });

  it("is false for a bank transfer return — buyer still has to send the wire", () => {
    expect(
      isAwaitingCaptureConfirmation({
        stripeReturnSuccess: true,
        paymentComplete: false,
        openPaymentStatus: "pending",
        openPaymentCheckoutRail: "gb_bank_transfer",
      }),
    ).toBe(false);
  });

  it("is true for a card return while still pending", () => {
    expect(
      isAwaitingCaptureConfirmation({
        stripeReturnSuccess: true,
        paymentComplete: false,
        openPaymentStatus: "pending",
        openPaymentCheckoutRail: "card",
      }),
    ).toBe(true);
  });
});
