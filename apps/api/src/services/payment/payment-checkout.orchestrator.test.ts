import { describe, expect, it, vi } from "vitest";
import type { IPaymentCheckoutProvider } from "../interfaces/payment-checkout.js";
import { PaymentCheckoutOrchestrator } from "./payment-checkout.orchestrator.js";

function provider(
  priority: number,
  result: { checkoutUrl: string | null; error?: string },
  available = true,
): IPaymentCheckoutProvider {
  return {
    priority,
    isAvailable: () => available,
    createCheckout: vi
      .fn()
      .mockResolvedValue({ ...result, provider: priority === 0 ? "stripe" : "xero" }),
  };
}

describe("PaymentCheckoutOrchestrator", () => {
  it("does not fall back to Xero when Stripe checkout is exclusive and fails", async () => {
    const stripe = provider(0, { checkoutUrl: null, error: "stripe down" });
    const xero = provider(10, { checkoutUrl: "https://xero.test/inv" });
    const orchestrator = new PaymentCheckoutOrchestrator([stripe, xero], true);

    const result = await orchestrator.createCheckout({
      paymentId: "pay1",
      lot: { id: "lot1" } as never,
      buyerEmail: "b@test.com",
      buyerName: "Buyer",
      amount: "100.00",
    });

    expect(result.checkoutUrl).toBeNull();
    expect(result.error).toBe("stripe down");
    expect(xero.createCheckout).not.toHaveBeenCalled();
  });
});
