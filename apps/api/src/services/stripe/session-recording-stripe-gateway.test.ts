import { describe, expect, it, vi } from "vitest";
import { SessionRecordingStripeGateway } from "./session-recording-stripe-gateway.js";
import type {
  CreateCheckoutSessionInput,
  IStripePaymentGateway,
} from "./stripe-payment-gateway.js";

const input = { paymentId: "pay-1" } as CreateCheckoutSessionInput;

describe("SessionRecordingStripeGateway", () => {
  it("records each session it opens before the link is returned", async () => {
    const order: string[] = [];
    const inner = {
      createCardCheckoutSession: vi.fn(async () => {
        order.push("stripe");
        return {
          sessionId: "cs_1",
          url: "https://checkout.stripe.com/cs_1",
          paymentIntentId: null,
        };
      }),
      createBankTransferCheckoutSession: vi.fn(async () => ({
        sessionId: "cs_2",
        url: "https://checkout.stripe.com/cs_2",
        paymentIntentId: null,
      })),
    } as unknown as IStripePaymentGateway;
    const record = vi.fn(async () => {
      order.push("recorded");
    });
    const gateway = new SessionRecordingStripeGateway(inner, { record });

    await expect(gateway.createCardCheckoutSession(input)).resolves.toMatchObject({
      sessionId: "cs_1",
    });
    await gateway.createBankTransferCheckoutSession({
      ...input,
      stripeCustomerId: "cus_1",
    } as never);

    expect(record).toHaveBeenNthCalledWith(1, "pay-1", "cs_1");
    expect(record).toHaveBeenNthCalledWith(2, "pay-1", "cs_2");
    expect(order.slice(0, 2)).toEqual(["stripe", "recorded"]);
  });

  it("does not hand out a link it could not record", async () => {
    const inner = {
      createCardCheckoutSession: vi.fn().mockResolvedValue({ sessionId: "cs_1", url: "u" }),
    } as unknown as IStripePaymentGateway;
    const gateway = new SessionRecordingStripeGateway(inner, {
      record: vi.fn().mockRejectedValue(new Error("db down")),
    });
    await expect(gateway.createCardCheckoutSession(input)).rejects.toThrow("db down");
  });
});
