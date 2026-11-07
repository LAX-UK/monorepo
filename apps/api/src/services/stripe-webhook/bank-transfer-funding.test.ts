import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { transferFunding } from "./bank-transfer-funding.js";

/** The shape of a `payment_intent.partially_funded` object, trimmed to what matters. */
function partiallyFunded(over: {
  amount_received?: number;
  amount_remaining?: number | null;
  instructions?: boolean;
}): Stripe.PaymentIntent {
  return {
    id: "pi_3QxPartial",
    object: "payment_intent",
    amount: 1_170_100,
    amount_received: over.amount_received ?? 0,
    currency: "gbp",
    status: "requires_action",
    payment_method_types: ["customer_balance"],
    next_action:
      over.instructions === false
        ? null
        : {
            type: "display_bank_transfer_instructions",
            display_bank_transfer_instructions: {
              amount_remaining: over.amount_remaining ?? null,
              currency: "gbp",
              financial_addresses: [],
              hosted_instructions_url: "https://payments.stripe.com/instructions/test",
              reference: "LAXB7KQ2R9",
              type: "gb_bank_transfer",
            },
          },
  } as unknown as Stripe.PaymentIntent;
}

describe("transferFunding", () => {
  it("takes what is still to send from the provider's instructions, and received is the rest", () => {
    // Stripe's amount_received can read 0 on a partially funded intent; the remainder is exact.
    expect(
      transferFunding(partiallyFunded({ amount_received: 0, amount_remaining: 570_100 })),
    ).toEqual({ remainingPence: 570_100, receivedPence: 600_000 });
  });

  it("falls back to the amount received when the instructions are gone", () => {
    expect(
      transferFunding(partiallyFunded({ amount_received: 600_000, instructions: false })),
    ).toEqual({
      remainingPence: 570_100,
      receivedPence: 600_000,
    });
  });

  it("falls back when the instructions carry no remainder", () => {
    expect(
      transferFunding(partiallyFunded({ amount_received: 600_000, amount_remaining: null })),
    ).toEqual({ remainingPence: 570_100, receivedPence: 600_000 });
  });

  it("reads a remainder of zero as fully received", () => {
    expect(transferFunding(partiallyFunded({ amount_remaining: 0 }))).toEqual({
      remainingPence: 0,
      receivedPence: 1_170_100,
    });
  });

  it("never reads a negative amount", () => {
    expect(
      transferFunding(partiallyFunded({ amount_received: 2_000_000, instructions: false })),
    ).toEqual({
      remainingPence: 0,
      receivedPence: 2_000_000,
    });
  });
});
