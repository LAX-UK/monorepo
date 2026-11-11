import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { FakeCashBalanceStripe } from "../../test/fake-cash-balance-stripe.js";
import { handleCashBalanceTransactionCreated } from "./cash-balance-transaction.handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";

vi.mock("../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn(async () => ({ claimed: true })),
}));

const event = {
  id: "evt_applied",
  type: "customer_cash_balance_transaction.created",
} as Stripe.Event;
const CUSTOMER = "cus_Rk3TestBuyer";

function setup() {
  const record = vi.fn().mockResolvedValue(undefined);
  const deps = {
    transactionRunner: { runInTransaction: async (fn: (tx: unknown) => unknown) => fn({}) },
    unappliedMoney: { record },
  } as unknown as StripePaymentWebhookDeps;
  const stripe = new FakeCashBalanceStripe();
  return { deps, record, stripe };
}

describe("handleCashBalanceTransactionCreated", () => {
  it("raises a task when a transfer sent with another invoice's reference is applied here", async () => {
    const { deps, record, stripe } = setup();
    stripe.fund({
      id: "ccsbtxn_funded",
      customer: CUSTOMER,
      reference: "REF-CANCELLED",
      created: 1000,
    });
    stripe.addIntent({ id: "pi_other", paymentId: "pay-other", ownReference: "REF-OTHER" });
    const txn = stripe.applied({
      id: "ccsbtxn_applied",
      customer: CUSTOMER,
      intentId: "pi_other",
      amountCents: 5_000,
      created: 1000,
    });

    const result = await handleCashBalanceTransactionCreated(deps, stripe.gateway(), event, txn);

    expect(result).toEqual({ processed: true, action: "transfer_applied_to_other_invoice" });
    expect(record).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      {
        reason: "transfer_applied_to_other_invoice",
        paymentId: "pay-other",
        paymentGroupId: null,
        stripePaymentIntentId: "pi_other",
        stripeChargeId: null,
        stripeCustomerId: CUSTOMER,
        cashBalanceTransactionId: "ccsbtxn_applied",
        transferReference: "REF-CANCELLED",
        amountCents: 5_000,
        currency: "gbp",
      },
      null,
    );
    expect(stripe.listCalls).toBe(1);
    expect(stripe.retrieveCalls).toBe(1);
  });

  it("raises nothing when the transfer quoted the receiving payment's own reference", async () => {
    const { deps, record, stripe } = setup();
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "ref-own", created: 1000 });
    stripe.addIntent({ id: "pi_own", paymentId: "pay-own", ownReference: "REF-OWN" });
    const result = await handleCashBalanceTransactionCreated(
      deps,
      stripe.gateway(),
      event,
      stripe.applied({
        id: "a1",
        customer: CUSTOMER,
        intentId: "pi_own",
        amountCents: 100,
        created: 1001,
      }),
    );
    expect(result).toMatchObject({ action: "skipped", reason: "reference_matches_or_unknown" });
    expect(record).not.toHaveBeenCalled();
  });

  it("raises nothing when the transfer quoted no reference", async () => {
    const { deps, record, stripe } = setup();
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: null, created: 1000 });
    stripe.addIntent({ id: "pi_own", paymentId: "pay-own", ownReference: "REF-OWN" });
    await handleCashBalanceTransactionCreated(
      deps,
      stripe.gateway(),
      event,
      stripe.applied({
        id: "a1",
        customer: CUSTOMER,
        intentId: "pi_own",
        amountCents: 100,
        created: 1000,
      }),
    );
    expect(record).not.toHaveBeenCalled();
  });

  it("uses the transfer received just before the application, not an older or later one", async () => {
    const { deps, record, stripe } = setup();
    stripe.fund({ id: "old", customer: CUSTOMER, reference: "REF-OLD", created: 500 });
    stripe.fund({ id: "right", customer: CUSTOMER, reference: "REF-OWN", created: 900 });
    stripe.fund({ id: "later", customer: CUSTOMER, reference: "REF-LATER", created: 2000 });
    stripe.addIntent({ id: "pi_own", paymentId: "pay-own", ownReference: "REF-OWN" });
    await handleCashBalanceTransactionCreated(
      deps,
      stripe.gateway(),
      event,
      stripe.applied({
        id: "a1",
        customer: CUSTOMER,
        intentId: "pi_own",
        amountCents: 100,
        created: 1000,
      }),
    );
    expect(record).not.toHaveBeenCalled();
  });

  it("names the payment group when the receiving payment is a combined one", async () => {
    const { deps, record, stripe } = setup();
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-X", created: 1000 });
    stripe.addIntent({ id: "pi_group", paymentGroupId: "group-1", ownReference: "REF-G" });
    await handleCashBalanceTransactionCreated(
      deps,
      stripe.gateway(),
      event,
      stripe.applied({
        id: "a1",
        customer: CUSTOMER,
        intentId: "pi_group",
        amountCents: 9_900,
        created: 1000,
      }),
    );
    expect(record.mock.calls[0]?.[1]).toMatchObject({
      paymentId: null,
      paymentGroupId: "group-1",
      amountCents: 9_900,
    });
  });

  it("checks nothing for ledger entries that are not applications", async () => {
    const { deps, record, stripe } = setup();
    const funded = {
      ...stripe.applied({
        id: "x",
        customer: CUSTOMER,
        intentId: "pi",
        amountCents: 1,
        created: 1,
      }),
      type: "funded",
    } as Stripe.CustomerCashBalanceTransaction;
    const result = await handleCashBalanceTransactionCreated(deps, stripe.gateway(), event, funded);
    expect(result).toMatchObject({ reason: "not_an_application" });
    expect(stripe.listCalls + stripe.retrieveCalls).toBe(0);
    expect(record).not.toHaveBeenCalled();
  });

  it("cannot compare once the payment no longer shows its reference, and says so without a task", async () => {
    const { deps, record, stripe } = setup();
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-X", created: 1000 });
    stripe.addIntent({ id: "pi_done", paymentId: "pay-done", ownReference: null });
    const result = await handleCashBalanceTransactionCreated(
      deps,
      stripe.gateway(),
      event,
      stripe.applied({
        id: "a1",
        customer: CUSTOMER,
        intentId: "pi_done",
        amountCents: 100,
        created: 1000,
      }),
    );
    expect(result).toMatchObject({ reason: "payment_reference_unavailable" });
    expect(record).not.toHaveBeenCalled();
  });
});
