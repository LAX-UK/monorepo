import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { StripePaymentGateway } from "./stripe-payment-gateway.js";

describe("StripePaymentGateway refunds on a charge shared by several invoices", () => {
  it("names the invoice on the refund and keeps equal refunds of two invoices apart", async () => {
    const create = vi.fn().mockResolvedValue({ id: "re_1" });
    const stripe = { refunds: { create } } as unknown as Stripe;
    const gateway = new StripePaymentGateway(
      { STRIPE_SECRET_KEY: "sk_test" },
      { get: () => stripe, require: () => stripe },
    );

    await gateway.createRefund({ chargeId: "ch_1", amount: 10_000, paymentId: "pay-a" });
    await gateway.createRefund({ chargeId: "ch_1", amount: 10_000, paymentId: "pay-b" });

    expect(create.mock.calls).toEqual([
      [
        expect.objectContaining({
          charge: "ch_1",
          amount: 10_000,
          metadata: { paymentId: "pay-a" },
        }),
        { idempotencyKey: "refund:ch_1:pay-a:10000" },
      ],
      [
        expect.objectContaining({ metadata: { paymentId: "pay-b" } }),
        { idempotencyKey: "refund:ch_1:pay-b:10000" },
      ],
    ]);
  });
});

describe("StripePaymentGateway part refunds of one payment", () => {
  it("makes two part refunds of the same amount two refunds, and keeps a lot's key unchanged", async () => {
    const create = vi.fn().mockResolvedValue({ id: "re_1" });
    const stripe = { refunds: { create } } as unknown as Stripe;
    const gateway = new StripePaymentGateway(
      { STRIPE_SECRET_KEY: "sk_test" },
      { get: () => stripe, require: () => stripe },
    );

    await gateway.createRefund({
      chargeId: "ch_1",
      amount: 5_000,
      paymentId: "pay-a",
      sequence: 0,
    });
    await gateway.createRefund({
      chargeId: "ch_1",
      amount: 5_000,
      paymentId: "pay-a",
      sequence: 5_000,
    });
    await gateway.createRefund({ chargeId: "ch_2", amount: 5_000, paymentId: "pay-b" });

    expect(create.mock.calls.map(([, options]) => options)).toEqual([
      { idempotencyKey: "refund:ch_1:pay-a:5000:0" },
      { idempotencyKey: "refund:ch_1:pay-a:5000:5000" },
      { idempotencyKey: "refund:ch_2:pay-b:5000" },
    ]);
  });
});
