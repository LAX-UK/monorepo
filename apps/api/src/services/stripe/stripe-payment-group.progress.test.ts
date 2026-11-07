import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { StripePaymentGroupGateway } from "./stripe-payment-group.gateway.js";

function gatewayWith(sessions: Record<string, unknown>) {
  const stripe = { checkout: { sessions } } as unknown as Stripe;
  const factory: IStripeClientFactory = { get: () => stripe, require: () => stripe };
  return new StripePaymentGroupGateway(factory);
}

const IN_THE_FUTURE = Math.floor(Date.now() / 1000) + 3600;
const IN_THE_PAST = Math.floor(Date.now() / 1000) - 60;

describe("StripePaymentGroupGateway.checkoutStatus", () => {
  it.each([
    [{ status: "complete", expires_at: IN_THE_FUTURE }, "complete"],
    [{ status: "expired", expires_at: IN_THE_PAST }, "expired"],
    [{ status: "open", expires_at: IN_THE_FUTURE }, "open"],
    // Past its own expiry but not yet marked by the provider: it can no longer be paid.
    [{ status: "open", expires_at: IN_THE_PAST }, "expired"],
  ])("reads %o as %s", async (session, expected) => {
    const retrieve = vi.fn(async () => session);
    const gateway = gatewayWith({ retrieve });
    await expect(gateway.checkoutStatus("cs_1")).resolves.toBe(expected);
    expect(retrieve).toHaveBeenCalledWith("cs_1");
  });
});

describe("StripePaymentGroupGateway.bankTransferInstructions", () => {
  const intent = (shown: unknown, extra: Record<string, unknown> = {}) => ({
    id: "pi_1",
    amount: 1_170_100,
    amount_received: 600_000,
    next_action: {
      type: "display_bank_transfer_instructions",
      display_bank_transfer_instructions: shown,
    },
    ...extra,
  });
  const sortCodeAddress = {
    type: "sort_code",
    sort_code: {
      account_holder_name: "London Auction Xchange LTD",
      account_number: "41926638",
      sort_code: "231470",
    },
  };

  it("reads the account, reference and what is still to send from the payment", async () => {
    const retrieve = vi.fn(async () => ({
      payment_intent: intent({
        reference: "LAXB7KQ2R9",
        amount_remaining: 570_100,
        financial_addresses: [{ type: "iban", iban: {} }, sortCodeAddress],
      }),
    }));
    const gateway = gatewayWith({ retrieve });
    await expect(gateway.bankTransferInstructions("cs_1")).resolves.toEqual({
      accountName: "London Auction Xchange LTD",
      sortCode: "231470",
      accountNumber: "41926638",
      reference: "LAXB7KQ2R9",
    });
    expect(retrieve).toHaveBeenCalledWith("cs_1", { expand: ["payment_intent"] });
  });

  it.each([
    ["no payment yet", { payment_intent: null }],
    ["an unexpanded payment", { payment_intent: "pi_1" }],
    ["a payment with no instructions", { payment_intent: { id: "pi_1", amount: 1 } }],
    [
      "instructions with no sort code",
      {
        payment_intent: intent({
          reference: "R",
          amount_remaining: 1,
          financial_addresses: [{ type: "iban", iban: {} }],
        }),
      },
    ],
    [
      "instructions with no reference",
      {
        payment_intent: intent({
          reference: null,
          amount_remaining: 1,
          financial_addresses: [sortCodeAddress],
        }),
      },
    ],
  ])("is null for %s", async (_name, session) => {
    const gateway = gatewayWith({ retrieve: async () => session });
    await expect(gateway.bankTransferInstructions("cs_1")).resolves.toBeNull();
  });
});

describe("StripePaymentGroupGateway.expireCheckout", () => {
  it("expires with an idempotency key for the session", async () => {
    const expire = vi.fn(async () => ({}));
    await gatewayWith({ expire }).expireCheckout("cs_1");
    expect(expire).toHaveBeenCalledWith("cs_1", undefined, {
      idempotencyKey: "checkout:expire:group:cs_1",
    });
  });
});
