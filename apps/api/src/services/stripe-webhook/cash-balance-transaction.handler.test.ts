import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { FakeCashBalanceStripe } from "../../test/fake-cash-balance-stripe.js";
import { InMemoryTransferReferences } from "../../test/in-memory-transfer-references.js";
import { handleCashBalanceTransactionCreated } from "./cash-balance-transaction.handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PaymentIntentRequiresActionHandler,
  ReferenceNotingHandler,
  rememberTransferReference,
} from "./transfer-reference.js";

vi.mock("../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn(async () => ({ claimed: true })),
}));

const event = {
  id: "evt_applied",
  type: "customer_cash_balance_transaction.created",
} as Stripe.Event;
const CUSTOMER = "cus_Rk3TestBuyer";
const PAY_OTHER = "11111111-1111-4111-8111-111111111111";
const PAY_CANCELLED = "22222222-2222-4222-8222-222222222222";
const GROUP = "33333333-3333-4333-8333-333333333333";

function setup() {
  const record = vi.fn().mockResolvedValue(undefined);
  const deps = {
    transactionRunner: { runInTransaction: async (fn: (tx: unknown) => unknown) => fn({}) },
    unappliedMoney: { record },
  } as unknown as StripePaymentWebhookDeps;
  const stripe = new FakeCashBalanceStripe();
  const references = new InMemoryTransferReferences();
  const checks = { cashBalance: stripe.gateway(), references };
  const run = (txn: Stripe.CustomerCashBalanceTransaction) =>
    handleCashBalanceTransactionCreated(deps, checks, event, txn);
  return { record, stripe, references, run };
}

const applied = (
  stripe: FakeCashBalanceStripe,
  intentId: string,
  created = 1000,
  amountCents = 5_000,
) => stripe.applied({ id: "ccsbtxn_applied", customer: CUSTOMER, intentId, amountCents, created });

describe("handleCashBalanceTransactionCreated", () => {
  it("raises a task, naming both invoices, when a transfer sent with another invoice's reference is applied here", async () => {
    const { record, stripe, references, run } = setup();
    // The invoice the reference was issued for, since cancelled: its reference was kept.
    await references.remember({
      stripePaymentIntentId: "pi_cancelled",
      reference: "REF-CANCELLED",
      paymentId: PAY_CANCELLED,
      paymentGroupId: null,
    });
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-CANCELLED", created: 1000 });
    stripe.addIntent({ id: "pi_other", paymentId: PAY_OTHER, ownReference: "REF-OTHER" });

    const result = await run(applied(stripe, "pi_other"));

    expect(result).toEqual({ processed: true, action: "transfer_applied_to_other_invoice" });
    expect(record).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      {
        reason: "transfer_applied_to_other_invoice",
        paymentId: PAY_OTHER,
        paymentGroupId: null,
        stripePaymentIntentId: "pi_other",
        stripeChargeId: null,
        stripeCustomerId: CUSTOMER,
        cashBalanceTransactionId: "ccsbtxn_applied",
        transferReference: "REF-CANCELLED",
        intendedPaymentId: PAY_CANCELLED,
        intendedPaymentGroupId: null,
        amountCents: 5_000,
        currency: "gbp",
      },
      null,
    );
    expect(stripe.listCalls).toBe(1);
    expect(stripe.retrieveCalls).toBe(1);
  });

  it("detects a transfer that fully paid the receiving invoice, from the reference kept earlier", async () => {
    const { record, stripe, references, run } = setup();
    await references.remember({
      stripePaymentIntentId: "pi_paid",
      reference: "REF-PAID",
      paymentId: PAY_OTHER,
      paymentGroupId: null,
    });
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-CANCELLED", created: 1000 });
    // The intent has completed: Stripe no longer shows its reference.
    stripe.addIntent({ id: "pi_paid", paymentId: PAY_OTHER, ownReference: null });

    const result = await run(applied(stripe, "pi_paid"));

    expect(result).toMatchObject({ action: "transfer_applied_to_other_invoice" });
    expect(record.mock.calls[0]?.[1]).toMatchObject({
      paymentId: PAY_OTHER,
      transferReference: "REF-CANCELLED",
      intendedPaymentId: null,
    });
  });

  it("raises nothing for a fully paid intent when the transfer quoted its own kept reference", async () => {
    const { record, stripe, references, run } = setup();
    await references.remember({
      stripePaymentIntentId: "pi_paid",
      reference: "ref-paid",
      paymentId: PAY_OTHER,
      paymentGroupId: null,
    });
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-PAID", created: 1000 });
    stripe.addIntent({ id: "pi_paid", paymentId: PAY_OTHER, ownReference: null });
    await run(applied(stripe, "pi_paid"));
    expect(record).not.toHaveBeenCalled();
  });

  it("keeps the live reference and counts a stored one that disagrees with it", async () => {
    const { record, stripe, references, run } = setup();
    await references.remember({
      stripePaymentIntentId: "pi_x",
      reference: "REF-STALE",
      paymentId: PAY_OTHER,
      paymentGroupId: null,
    });
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-LIVE", created: 1000 });
    stripe.addIntent({ id: "pi_x", paymentId: PAY_OTHER, ownReference: "REF-LIVE" });
    await run(applied(stripe, "pi_x"));
    // The live reference decides: the transfer quoted it, so there is no task.
    expect(record).not.toHaveBeenCalled();
  });

  it("keeps a live reference it sees, once", async () => {
    const { stripe, references, run } = setup();
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-OWN", created: 1000 });
    stripe.addIntent({ id: "pi_own", paymentId: PAY_OTHER, ownReference: "REF-OWN" });
    await run(applied(stripe, "pi_own"));
    await run(applied(stripe, "pi_own"));
    expect(references.rows.size).toBe(1);
    expect(references.rows.get("pi_own")?.reference).toBe("REF-OWN");
  });

  it("raises nothing when the transfer quoted no reference", async () => {
    const { record, stripe, run } = setup();
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: null, created: 1000 });
    stripe.addIntent({ id: "pi_own", paymentId: PAY_OTHER, ownReference: "REF-OWN" });
    await run(applied(stripe, "pi_own"));
    expect(record).not.toHaveBeenCalled();
  });

  it("uses the transfer received just before the application, not an older or later one", async () => {
    const { record, stripe, run } = setup();
    stripe.fund({ id: "old", customer: CUSTOMER, reference: "REF-OLD", created: 500 });
    stripe.fund({ id: "right", customer: CUSTOMER, reference: "REF-OWN", created: 900 });
    stripe.fund({ id: "later", customer: CUSTOMER, reference: "REF-LATER", created: 2000 });
    stripe.addIntent({ id: "pi_own", paymentId: PAY_OTHER, ownReference: "REF-OWN" });
    await run(applied(stripe, "pi_own"));
    expect(record).not.toHaveBeenCalled();
  });

  it("names the payment group when the receiving payment is a combined one", async () => {
    const { record, stripe, run } = setup();
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-X", created: 1000 });
    stripe.addIntent({ id: "pi_group", paymentGroupId: GROUP, ownReference: "REF-G" });
    await run(applied(stripe, "pi_group", 1000, 9_900));
    expect(record.mock.calls[0]?.[1]).toMatchObject({
      paymentId: null,
      paymentGroupId: GROUP,
      amountCents: 9_900,
    });
  });

  it("checks nothing for ledger entries that are not applications", async () => {
    const { record, stripe, run } = setup();
    const funded = {
      ...applied(stripe, "pi"),
      type: "funded",
    } as Stripe.CustomerCashBalanceTransaction;
    expect(await run(funded)).toMatchObject({ reason: "not_an_application" });
    expect(stripe.listCalls + stripe.retrieveCalls).toBe(0);
    expect(record).not.toHaveBeenCalled();
  });

  it("cannot compare an intent whose reference was never kept and is no longer shown, and says so without a task", async () => {
    const { record, stripe, run } = setup();
    stripe.fund({ id: "f1", customer: CUSTOMER, reference: "REF-X", created: 1000 });
    stripe.addIntent({ id: "pi_old", paymentId: PAY_OTHER, ownReference: null });
    expect(await run(applied(stripe, "pi_old"))).toMatchObject({
      reason: "payment_reference_unavailable",
    });
    expect(record).not.toHaveBeenCalled();
  });
});

describe("keeping the reference an intent shows", () => {
  const intent = (over: Partial<Stripe.PaymentIntent> = {}) =>
    ({
      id: "pi_1",
      metadata: { paymentId: PAY_OTHER },
      next_action: {
        type: "display_bank_transfer_instructions",
        display_bank_transfer_instructions: { reference: "REF-1" },
      },
      ...over,
    }) as unknown as Stripe.PaymentIntent;

  it("writes the reference once, with the payment it belongs to, however often it is seen", async () => {
    const references = new InMemoryTransferReferences();
    await rememberTransferReference(references, intent());
    await rememberTransferReference(references, intent());
    expect(references.rows.get("pi_1")).toEqual({
      stripePaymentIntentId: "pi_1",
      reference: "REF-1",
      paymentId: PAY_OTHER,
      paymentGroupId: null,
    });
    expect(references.rows.size).toBe(1);
  });

  it("writes nothing for an intent that shows no reference (a card payment)", async () => {
    const references = new InMemoryTransferReferences();
    await rememberTransferReference(references, intent({ next_action: null }));
    expect(references.writes).toBe(0);
  });

  it("ignores metadata that is not an id", async () => {
    const references = new InMemoryTransferReferences();
    await rememberTransferReference(references, intent({ metadata: { paymentId: "deal-1" } }));
    expect(references.rows.get("pi_1")?.paymentId).toBeNull();
  });

  it("the requires-action handler keeps it and the noting wrapper keeps it before the inner handler runs", async () => {
    const references = new InMemoryTransferReferences();
    await new PaymentIntentRequiresActionHandler(references).handle(event, intent());
    expect(references.rows.has("pi_1")).toBe(true);

    const other = new InMemoryTransferReferences();
    const inner = {
      handle: vi.fn(async () => {
        expect(other.rows.has("pi_1")).toBe(true);
        return { processed: true, action: "payment_intent_partially_funded" as const };
      }),
    };
    const result = await new ReferenceNotingHandler(inner, other).handle(event, intent());
    expect(result).toEqual({ processed: true, action: "payment_intent_partially_funded" });
    expect(inner.handle).toHaveBeenCalledOnce();
  });
});
