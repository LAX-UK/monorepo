import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { FakeCashBalanceStripe } from "../../test/fake-cash-balance-stripe.js";
import { InMemoryTransferReferences } from "../../test/in-memory-transfer-references.js";
import { handleCashBalanceTransactionCreated } from "./cash-balance-transaction.handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";
import {
  PaymentIntentRequiresActionHandler,
  ReferenceNotingHandler,
  rememberTransferDetails,
} from "./transfer-reference.js";

vi.mock("../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn(async () => ({ claimed: true })),
}));

const OLD_EVENT = {
  id: "evt_applied",
  type: "customer_cash_balance_transaction.created",
  created: Math.floor(Date.now() / 1000) - 3600,
} as Stripe.Event;
const CUSTOMER = "cus_Rk3TestBuyer";
const PAY_RECEIVING = "11111111-1111-4111-8111-111111111111";
const PAY_INTENDED = "22222222-2222-4222-8222-222222222222";
const GROUP = "33333333-3333-4333-8333-333333333333";
const DEAL = "44444444-4444-4444-8444-444444444444";
const DEAL_PAYMENT = "55555555-5555-4555-8555-555555555555";

type Owner = {
  stripeCustomerId: string | null;
  paymentId: string | null;
  paymentGroupId: string | null;
  privateSaleDealId: string | null;
  privateSaleDealPaymentId: string | null;
};
const noOwner: Owner = {
  stripeCustomerId: CUSTOMER,
  paymentId: null,
  paymentGroupId: null,
  privateSaleDealId: null,
  privateSaleDealPaymentId: null,
};

function setup(opts: { members?: Record<string, string[]> } = {}) {
  const record = vi.fn().mockResolvedValue(undefined);
  const report = vi.fn();
  const deps = {
    transactionRunner: { runInTransaction: async (fn: (tx: unknown) => unknown) => fn({}) },
    unappliedMoney: { record },
    errorReporter: { report },
  } as unknown as StripePaymentWebhookDeps;
  const stripe = new FakeCashBalanceStripe();
  const references = new InMemoryTransferReferences();
  const groups = {
    listMembers: vi.fn(async (id: string) =>
      (opts.members?.[id] ?? []).map((paymentId) => ({ paymentId })),
    ),
  };
  const deals = { findById: vi.fn(async () => ({ reference: "PS-0012" })) };
  const checks = {
    cashBalance: stripe.gateway(),
    references,
    groups: groups as never,
    deals: deals as never,
  };
  const run = (txn: Stripe.CustomerCashBalanceTransaction, event = OLD_EVENT) =>
    handleCashBalanceTransactionCreated(deps, checks, event, txn);
  const issue = (intent: string, reference: string, owner: Partial<Owner> = {}) =>
    references.remember({
      stripePaymentIntentId: intent,
      reference,
      ...noOwner,
      ...owner,
    });
  return { record, report, stripe, references, run, issue, groups };
}

describe("handleCashBalanceTransactionCreated", () => {
  it("raises a task naming both invoices when a transfer sent with another invoice's reference is applied here", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_cancelled", "REFCANCELLED", { paymentId: PAY_INTENDED });
    stripe.fund({ customer: CUSTOMER, reference: "REF CANCELLED", created: 1000 });
    stripe.addIntent({
      id: "pi_other",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOTHER",
    });
    const txn = stripe.apply({
      id: "ccsbtxn_applied",
      customer: CUSTOMER,
      intentId: "pi_other",
      created: 1000,
    });

    const result = await run(txn);

    expect(result).toEqual({ processed: true, action: "transfer_applied_to_other_invoice" });
    expect(record).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      {
        reason: "transfer_applied_to_other_invoice",
        paymentId: PAY_RECEIVING,
        paymentGroupId: null,
        stripePaymentIntentId: "pi_other",
        stripeChargeId: null,
        stripeCustomerId: CUSTOMER,
        cashBalanceTransactionId: "ccsbtxn_applied",
        // The reference we issued, not what the sender typed.
        transferReference: "REFCANCELLED",
        intendedPaymentId: PAY_INTENDED,
        intendedPaymentGroupId: null,
        privateSaleDealId: null,
        privateSaleDealPaymentId: null,
        privateSaleDealReference: null,
        amountCents: 5_000,
        currency: "gbp",
      },
      null,
    );
  });

  it("detects a transfer that fully paid the receiving invoice, from the reference kept earlier", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_paid", "REFPAID", { paymentId: PAY_RECEIVING });
    await issue("pi_cancelled", "REFCANCELLED", { paymentId: PAY_INTENDED });
    stripe.fund({ customer: CUSTOMER, reference: "REFCANCELLED", created: 1000 });
    // The intent has completed: Stripe no longer shows its reference.
    stripe.addIntent({
      id: "pi_paid",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: null,
    });
    const txn = stripe.apply({ customer: CUSTOMER, intentId: "pi_paid", created: 1000 });

    expect(await run(txn)).toMatchObject({ action: "transfer_applied_to_other_invoice" });
    expect(record.mock.calls[0]?.[1]).toMatchObject({
      paymentId: PAY_RECEIVING,
      intendedPaymentId: PAY_INTENDED,
    });
  });

  it("raises nothing when the transfer quoted the payment's own reference, even among the bank's own text", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_paid", "R7WQKX5C", { paymentId: PAY_RECEIVING });
    stripe.fund({ customer: CUSTOMER, reference: "FPS J SMITH r7wq-kx5c", created: 1000 });
    stripe.addIntent({
      id: "pi_paid",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: null,
    });
    expect(
      await run(stripe.apply({ customer: CUSTOMER, intentId: "pi_paid", created: 1000 })),
    ).toMatchObject({
      reason: "reference_matches",
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("does not call text that is none of our references another invoice's", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_own", "REFOWN", { paymentId: PAY_RECEIVING });
    stripe.fund({ customer: CUSTOMER, reference: "INVOICE 55 J SMITH", created: 1000 });
    stripe.addIntent({
      id: "pi_own",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOWN",
    });
    expect(
      await run(stripe.apply({ customer: CUSTOMER, intentId: "pi_own", created: 1000 })),
    ).toMatchObject({
      reason: "reference_not_issued_here",
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("only matches a reference within the same buyer", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_other_buyer", "REFELSEWHERE", {
      paymentId: PAY_INTENDED,
      stripeCustomerId: "cus_someone_else",
    });
    stripe.fund({ customer: CUSTOMER, reference: "REFELSEWHERE", created: 1000 });
    stripe.addIntent({
      id: "pi_own",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOWN",
    });
    await run(stripe.apply({ customer: CUSTOMER, intentId: "pi_own", created: 1000 }));
    expect(record).not.toHaveBeenCalled();
  });

  it("skips a reference that resolves to the same invoice, or to the combined payment that holds it", async () => {
    const same = setup();
    await same.issue("pi_old", "REFOLD", { paymentId: PAY_RECEIVING });
    same.stripe.fund({ customer: CUSTOMER, reference: "REFOLD", created: 1000 });
    same.stripe.addIntent({
      id: "pi_new",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFNEW",
    });
    expect(
      await same.run(same.stripe.apply({ customer: CUSTOMER, intentId: "pi_new", created: 1000 })),
    ).toMatchObject({ reason: "same_invoice" });
    expect(same.record).not.toHaveBeenCalled();

    const member = setup({ members: { [GROUP]: [PAY_INTENDED] } });
    await member.issue("pi_single", "REFSINGLE", { paymentId: PAY_INTENDED });
    member.stripe.fund({ customer: CUSTOMER, reference: "REFSINGLE", created: 1000 });
    member.stripe.addIntent({
      id: "pi_group",
      customer: CUSTOMER,
      paymentGroupId: GROUP,
      ownReference: "REFGROUP",
    });
    expect(
      await member.run(
        member.stripe.apply({ customer: CUSTOMER, intentId: "pi_group", created: 1000 }),
      ),
    ).toMatchObject({ reason: "same_invoice" });

    const group = setup({ members: { [GROUP]: [PAY_RECEIVING] } });
    await group.issue("pi_group_old", "REFGROUPOLD", { paymentGroupId: GROUP });
    group.stripe.fund({ customer: CUSTOMER, reference: "REFGROUPOLD", created: 1000 });
    group.stripe.addIntent({
      id: "pi_single",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFSINGLENEW",
    });
    expect(
      await group.run(
        group.stripe.apply({ customer: CUSTOMER, intentId: "pi_single", created: 1000 }),
      ),
    ).toMatchObject({ reason: "same_invoice" });
  });

  it("names a payment that was part funded, then cancelled, with its money moved to another payment", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_cancelled", "REFCANCELLED", { paymentId: PAY_INTENDED });
    stripe.fund({ customer: CUSTOMER, reference: "REFCANCELLED", created: 900 });
    stripe.apply({ customer: CUSTOMER, intentId: "pi_cancelled", created: 900 });
    stripe.unapply({ customer: CUSTOMER, intentId: "pi_cancelled", created: 1000 });
    stripe.addIntent({
      id: "pi_other",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOTHER",
    });
    const txn = stripe.apply({ customer: CUSTOMER, intentId: "pi_other", created: 1000 });

    expect(await run(txn)).toMatchObject({ action: "transfer_applied_to_other_invoice" });
    expect(record.mock.calls[0]?.[1]).toMatchObject({
      paymentId: PAY_RECEIVING,
      intendedPaymentId: PAY_INTENDED,
      transferReference: "REFCANCELLED",
    });
  });

  it("uses the newest transfer behind the application, skipping other applications between", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_old", "REFOLD", { paymentId: PAY_INTENDED });
    stripe.fund({ customer: CUSTOMER, reference: "REFOLD", created: 500 });
    stripe.fund({ customer: CUSTOMER, reference: "REFOWN", created: 900 });
    stripe.apply({ customer: CUSTOMER, intentId: "pi_elsewhere", created: 950 });
    stripe.addIntent({
      id: "pi_own",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOWN",
    });
    const txn = stripe.apply({ customer: CUSTOMER, intentId: "pi_own", created: 1000 });
    await run(txn);
    expect(record).not.toHaveBeenCalled();
  });

  it("finds a source more than one page back", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_cancelled", "REFCANCELLED", { paymentId: PAY_INTENDED });
    stripe.fund({ customer: CUSTOMER, reference: "REFCANCELLED", created: 100 });
    for (let i = 0; i < 30; i += 1) {
      stripe.apply({ customer: CUSTOMER, intentId: `pi_elsewhere_${i}`, created: 200 + i });
    }
    stripe.addIntent({
      id: "pi_other",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOTHER",
    });
    const txn = stripe.apply({ customer: CUSTOMER, intentId: "pi_other", created: 300 });
    expect(await run(txn)).toMatchObject({ action: "transfer_applied_to_other_invoice" });
    expect(stripe.listCalls).toBe(2);
    expect(record).toHaveBeenCalledOnce();
  });

  it("stops at the page cap and says so, without a task", async () => {
    const { record, stripe, run } = setup();
    stripe.fund({ customer: CUSTOMER, reference: "REFCANCELLED", created: 100 });
    for (let i = 0; i < 130; i += 1) {
      stripe.apply({ customer: CUSTOMER, intentId: `pi_elsewhere_${i}`, created: 200 });
    }
    stripe.addIntent({
      id: "pi_other",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOTHER",
    });
    const txn = stripe.apply({ customer: CUSTOMER, intentId: "pi_other", created: 300 });
    expect(await run(txn)).toMatchObject({ reason: "supply_not_found" });
    expect(stripe.listCalls).toBe(4);
    expect(record).not.toHaveBeenCalled();
  });

  it("orders by the ledger, not by seconds, when entries share one", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_cancelled", "REFCANCELLED", { paymentId: PAY_INTENDED });
    // Same second: the transfer, the application, then the later transfer behind the next one.
    stripe.fund({ customer: CUSTOMER, reference: "REFOWN", created: 1000 });
    stripe.apply({ customer: CUSTOMER, intentId: "pi_first", created: 1000 });
    stripe.fund({ customer: CUSTOMER, reference: "REFCANCELLED", created: 1000 });
    stripe.addIntent({
      id: "pi_other",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOWN",
    });
    const txn = stripe.apply({ customer: CUSTOMER, intentId: "pi_other", created: 1000 });
    await run(txn);
    // The nearest transfer behind it quoted another reference.
    expect(record.mock.calls[0]?.[1]).toMatchObject({ intendedPaymentId: PAY_INTENDED });
  });

  it("keeps the live reference when a kept one disagrees with it", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_x", "REFSTALE", { paymentId: PAY_RECEIVING });
    stripe.fund({ customer: CUSTOMER, reference: "REFLIVE", created: 1000 });
    stripe.addIntent({
      id: "pi_x",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFLIVE",
    });
    await run(stripe.apply({ customer: CUSTOMER, intentId: "pi_x", created: 1000 }));
    expect(record).not.toHaveBeenCalled();
  });

  it("keeps a live reference it sees, once", async () => {
    const { stripe, references, run } = setup();
    stripe.fund({ customer: CUSTOMER, reference: "REFOWN", created: 1000 });
    stripe.addIntent({
      id: "pi_own",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOWN",
    });
    await run(stripe.apply({ customer: CUSTOMER, intentId: "pi_own", created: 1000 }));
    await run(stripe.apply({ customer: CUSTOMER, intentId: "pi_own", created: 1001 }));
    expect(references.rows.size).toBe(1);
    expect(references.rows.get("pi_own")).toMatchObject({
      reference: "REFOWN",
      stripeCustomerId: CUSTOMER,
    });
  });

  it("raises nothing when the transfer quoted no reference", async () => {
    const { record, stripe, run } = setup();
    stripe.fund({ customer: CUSTOMER, reference: null, created: 1000 });
    stripe.addIntent({
      id: "pi_own",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: "REFOWN",
    });
    expect(
      await run(stripe.apply({ customer: CUSTOMER, intentId: "pi_own", created: 1000 })),
    ).toMatchObject({ reason: "no_reference_quoted" });
    expect(record).not.toHaveBeenCalled();
  });

  it("names the combined payment when that received the money", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_cancelled", "REFCANCELLED", { paymentId: PAY_INTENDED });
    stripe.fund({ customer: CUSTOMER, reference: "REFCANCELLED", created: 1000 });
    stripe.addIntent({
      id: "pi_group",
      customer: CUSTOMER,
      paymentGroupId: GROUP,
      ownReference: "REFG",
    });
    await run(
      stripe.apply({ customer: CUSTOMER, intentId: "pi_group", amountCents: 9_900, created: 1000 }),
    );
    expect(record.mock.calls[0]?.[1]).toMatchObject({
      paymentId: null,
      paymentGroupId: GROUP,
      amountCents: 9_900,
    });
  });

  it("carries a private sale deal's reference so the task links to the deal", async () => {
    const { record, stripe, run, issue } = setup();
    await issue("pi_cancelled", "REFCANCELLED", { paymentId: PAY_INTENDED });
    stripe.fund({ customer: CUSTOMER, reference: "REFCANCELLED", created: 1000 });
    stripe.addIntent({
      id: "pi_deal",
      customer: CUSTOMER,
      privateSaleDealId: DEAL,
      privateSaleDealPaymentId: DEAL_PAYMENT,
      ownReference: "REFDEAL",
    });
    await run(stripe.apply({ customer: CUSTOMER, intentId: "pi_deal", created: 1000 }));
    expect(record.mock.calls[0]?.[1]).toMatchObject({
      paymentId: null,
      privateSaleDealId: DEAL,
      privateSaleDealPaymentId: DEAL_PAYMENT,
      privateSaleDealReference: "PS-0012",
    });
  });

  it("checks nothing for ledger entries that are not applications", async () => {
    const { record, stripe, run } = setup();
    const funded = stripe.fund({ customer: CUSTOMER, reference: "X", created: 1 });
    expect(await run(funded)).toMatchObject({ reason: "not_an_application" });
    expect(stripe.listCalls + stripe.retrieveCalls).toBe(0);
    expect(record).not.toHaveBeenCalled();
  });

  it("asks for a redelivery while a payment's reference may still be on its way, then gives up", async () => {
    const { record, stripe, run } = setup();
    stripe.fund({ customer: CUSTOMER, reference: "REFX", created: 1000 });
    stripe.addIntent({
      id: "pi_done",
      customer: CUSTOMER,
      paymentId: PAY_RECEIVING,
      ownReference: null,
    });
    const txn = stripe.apply({ customer: CUSTOMER, intentId: "pi_done", created: 1000 });
    const fresh = { ...OLD_EVENT, created: Math.floor(Date.now() / 1000) - 5 } as Stripe.Event;
    expect(await run(txn, fresh)).toEqual({
      processed: false,
      action: "skipped",
      reason: "payment_reference_pending",
    });
    expect(await run(txn, OLD_EVENT)).toMatchObject({
      processed: true,
      reason: "payment_reference_unavailable",
    });
    expect(record).not.toHaveBeenCalled();
  });
});

describe("keeping the reference an intent shows", () => {
  const event = OLD_EVENT;
  const intent = (over: Partial<Stripe.PaymentIntent> = {}) =>
    ({
      id: "pi_1",
      customer: CUSTOMER,
      metadata: { paymentId: PAY_RECEIVING },
      next_action: {
        type: "display_bank_transfer_instructions",
        display_bank_transfer_instructions: { reference: "REF-1" },
      },
      ...over,
    }) as unknown as Stripe.PaymentIntent;
  const details = (i: Stripe.PaymentIntent) => ({
    ownReference: "REF-1",
    ...noOwner,
    paymentId: i.metadata?.paymentId ?? null,
  });

  it("writes the reference once, with the payment and buyer it belongs to, however often it is seen", async () => {
    const references = new InMemoryTransferReferences();
    await rememberTransferDetails(references, "pi_1", details(intent()));
    await rememberTransferDetails(references, "pi_1", details(intent()));
    expect(references.rows.get("pi_1")).toEqual({
      stripePaymentIntentId: "pi_1",
      reference: "REF-1",
      ...noOwner,
      paymentId: PAY_RECEIVING,
    });
    expect(references.rows.size).toBe(1);
  });

  it("writes nothing for an intent that shows no reference (a card payment)", async () => {
    const references = new InMemoryTransferReferences();
    await rememberTransferDetails(references, "pi_1", { ...details(intent()), ownReference: null });
    expect(references.writes).toBe(0);
  });

  it("reads the intent the one way: ids that are not uuids are ignored, deals are carried", async () => {
    const references = new InMemoryTransferReferences();
    const handler = new PaymentIntentRequiresActionHandler(references);
    await handler.handle(
      event,
      intent({
        metadata: {
          paymentId: "deal-1",
          privateSaleDealId: DEAL,
          privateSaleDealPaymentId: DEAL_PAYMENT,
        },
      }),
    );
    expect(references.rows.get("pi_1")).toMatchObject({
      paymentId: null,
      privateSaleDealId: DEAL,
      privateSaleDealPaymentId: DEAL_PAYMENT,
      stripeCustomerId: CUSTOMER,
    });
  });

  it("keeps it before the wrapped handler runs, and runs that handler even when keeping fails", async () => {
    const other = new InMemoryTransferReferences();
    const inner = {
      handle: vi.fn(async () => {
        expect(other.rows.has("pi_1")).toBe(true);
        return { processed: true, action: "payment_intent_partially_funded" as const };
      }),
    };
    expect(await new ReferenceNotingHandler(inner, other).handle(event, intent())).toEqual({
      processed: true,
      action: "payment_intent_partially_funded",
    });

    const failing = {
      ...new InMemoryTransferReferences(),
      remember: vi.fn().mockRejectedValue(new Error("db down")),
    };
    const report = vi.fn();
    const inner2 = { handle: vi.fn(async () => ({ processed: true as const })) };
    const result = await new ReferenceNotingHandler(inner2, failing as never, { report }).handle(
      event,
      intent(),
    );
    expect(result).toEqual({ processed: true });
    expect(inner2.handle).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ code: "transfer_reference_not_kept" }),
    );

    const quiet = await new PaymentIntentRequiresActionHandler(failing as never, { report }).handle(
      event,
      intent(),
    );
    expect(quiet.processed).toBe(true);
  });
});
