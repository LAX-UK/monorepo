import { describe, expect, it } from "vitest";
import { resolveCheckoutPagePaymentState } from "./checkout-page-state";

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
});
