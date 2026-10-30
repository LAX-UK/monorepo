import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import type { CreateGroupCheckoutInput } from "../payment-group/payment-group-ports.js";
import { StripePaymentGroupGateway } from "./stripe-payment-group.gateway.js";

function gatewayWith(stripe: unknown) {
  const factory: IStripeClientFactory = {
    get: () => stripe as Stripe,
    require: () => stripe as Stripe,
  };
  return new StripePaymentGroupGateway(factory);
}

const INPUT: CreateGroupCheckoutInput = {
  paymentGroupId: "group-1",
  rail: "card",
  currency: "GBP",
  totalPence: 100_010,
  lines: [
    { paymentId: "pay-2", lotId: "lot-2", lotTitle: "Harbour", lotNumber: 12, amountPence: 60_010 },
    { paymentId: "pay-3", lotId: "lot-3", lotTitle: "Study", lotNumber: null, amountPence: 40_000 },
  ],
  buyerEmail: "payer@example.com",
  stripeCustomerId: null,
  successUrl: "https://lax.example/purchases?payment=success",
  cancelUrl: "https://lax.example/purchases?payment=cancelled",
};

describe("StripePaymentGroupGateway", () => {
  it("opens one checkout per group, idempotent on the group, with each invoice as a line", async () => {
    const create = vi.fn(async () => ({
      id: "cs_1",
      url: "https://stripe/cs_1",
      payment_intent: null,
    }));
    const gateway = gatewayWith({ checkout: { sessions: { create } } });
    expect(await gateway.createCheckout(INPUT)).toEqual({
      sessionId: "cs_1",
      url: "https://stripe/cs_1",
      paymentIntentId: null,
    });
    const [params, options] = create.mock.calls[0] as unknown as [
      Stripe.Checkout.SessionCreateParams,
      { idempotencyKey: string },
    ];
    expect(options).toEqual({ idempotencyKey: "checkout:card:group:group-1" });
    expect(params.metadata).toEqual({ paymentGroupId: "group-1", checkoutRail: "card" });
    expect(params.payment_intent_data?.metadata).toEqual(params.metadata);
    expect(
      params.line_items?.map((l) => [l.price_data?.unit_amount, l.price_data?.product_data?.name]),
    ).toEqual([
      [60_010, "Lot 12 · Harbour"],
      [40_000, "Study"],
    ]);
    expect(params.customer_email).toBe("payer@example.com");
  });

  it("takes a bank transfer into the account's customer balance", async () => {
    const create = vi.fn(async () => ({
      id: "cs_2",
      url: "https://stripe/cs_2",
      payment_intent: "pi_2",
    }));
    const gateway = gatewayWith({ checkout: { sessions: { create } } });
    await gateway.createCheckout({ ...INPUT, rail: "gb_bank_transfer", stripeCustomerId: "cus_1" });
    const [params, options] = create.mock.calls[0] as unknown as [
      Stripe.Checkout.SessionCreateParams,
      { idempotencyKey: string },
    ];
    expect(options.idempotencyKey).toBe("checkout:bank:group:group-1");
    expect(params.customer).toBe("cus_1");
    expect(params.payment_method_types).toEqual(["customer_balance"]);
    await expect(
      gateway.createCheckout({ ...INPUT, rail: "gb_bank_transfer", stripeCustomerId: null }),
    ).rejects.toThrow();
  });

  it("reads each refund with the invoice it names, counting only money returned", async () => {
    const refunds = [
      { amount: 500, status: "succeeded", metadata: { paymentId: "pay-2" } },
      { amount: 200, status: "pending", metadata: {} },
      { amount: 900, status: "failed", metadata: { paymentId: "pay-3" } },
    ];
    const list = vi.fn(() => ({
      async *[Symbol.asyncIterator]() {
        yield* refunds;
      },
    }));
    const gateway = gatewayWith({ refunds: { list } });
    expect(await gateway.listChargeRefunds("ch_1")).toEqual([
      { paymentId: "pay-2", amountPence: 500 },
      { paymentId: null, amountPence: 200 },
    ]);
    expect(list).toHaveBeenCalledWith({ charge: "ch_1", limit: 100 });
  });
});
