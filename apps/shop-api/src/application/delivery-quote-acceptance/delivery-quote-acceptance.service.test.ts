import { QUOTE_PAYMENT_WINDOW_MS } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import { createDeliveryQuoteAcceptanceService } from "./delivery-quote-acceptance.service.js";

const NOW = new Date("2026-11-12T10:00:00Z");

function build(exportPaymentEnabled = true) {
  const order: string[] = [];
  const accept = vi.fn(async () => {
    order.push("accept");
  });
  const resumeCheckoutOrder = vi.fn(async () => {
    order.push("resume");
    return { orderId: "o-1", checkoutUrl: "https://pay.test/s", expiresAt: NOW };
  });
  const service = createDeliveryQuoteAcceptanceService({
    store: { accept },
    checkout: { resumeCheckoutOrder },
    exportPaymentEnabled,
    now: () => NOW,
  });
  return { service, accept, resumeCheckoutOrder, order };
}

const input = {
  subject: "subject-1",
  orderId: "o-1",
  successUrl: "https://shop.test/ok",
  cancelUrl: "https://shop.test/cancel",
};

describe("accepting a delivery quote and paying", () => {
  it("prices the order first, with a payment window, and only then opens payment", async () => {
    const { service, accept, order } = build();
    const session = await service.acceptAndPay(input);
    expect(session.checkoutUrl).toBe("https://pay.test/s");
    expect(order).toEqual(["accept", "resume"]);
    expect(accept).toHaveBeenCalledWith({
      subject: "subject-1",
      orderId: "o-1",
      now: NOW,
      paymentEndsAt: new Date(NOW.getTime() + QUOTE_PAYMENT_WINDOW_MS),
    });
  });

  it("accepts nothing and opens nothing while payment outside the UK is closed", async () => {
    const { service, accept, resumeCheckoutOrder } = build(false);
    await expect(service.acceptAndPay(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(accept).not.toHaveBeenCalled();
    expect(resumeCheckoutOrder).not.toHaveBeenCalled();
  });

  it("does not open payment when the quote could not be accepted", async () => {
    const { service, accept, resumeCheckoutOrder } = build();
    accept.mockRejectedValueOnce(new Error("This quote has expired"));
    await expect(service.acceptAndPay(input)).rejects.toThrow("This quote has expired");
    expect(resumeCheckoutOrder).not.toHaveBeenCalled();
  });
});
