import type { PaymentGroupRecord } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  POSSIBLE_SOURCE_LOOKBACK_MS,
  handleCustomerBalanceFundsAvailable,
  possibleSourceGroup,
} from "./customer-balance-unapplied.handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";

vi.mock("../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn(async () => ({ claimed: true })),
}));

/** A recorded `cash_balance.funds_available` object: what is left after Stripe applied what it could. */
const balance = (available: Record<string, number>) =>
  ({
    object: "cash_balance",
    customer: "cus_Rk3TestBuyer",
    livemode: false,
    available,
    settings: { reconciliation_mode: "automatic", using_merchant_default: true },
  }) as unknown as Stripe.CashBalance;

const event = { id: "evt_1QcashFunds", type: "cash_balance.funds_available" } as Stripe.Event;

const group = (over: Partial<PaymentGroupRecord> = {}): PaymentGroupRecord => ({
  id: "group-1",
  buyerLegalEntityId: "org-1",
  createdByUserId: "payer-1",
  status: "processing",
  currency: "GBP",
  totalAmount: "11701.00",
  checkoutRail: "gb_bank_transfer",
  stripeCheckoutSessionId: "cs_1",
  stripePaymentIntentId: "pi_1",
  stripeChargeId: null,
  amountReceived: "6000.00",
  receivedEventAt: null,
  createdAt: new Date(),
  settledAt: null,
  ...over,
});

function setup(candidates: PaymentGroupRecord[]) {
  const record = vi.fn(async () => undefined);
  const deps = {
    transactionRunner: { runInTransaction: async (fn: (tx: never) => unknown) => fn({} as never) },
    unappliedMoney: { record },
  } as unknown as StripePaymentWebhookDeps;
  const find = vi.fn(async () => candidates);
  return { deps, record, find, groups: { findBankTransferGroupsForCustomer: find } };
}

const recorded = (record: ReturnType<typeof vi.fn>) =>
  (record.mock.calls[0] as unknown as [unknown, Record<string, unknown>, unknown])[1];

describe("handleCustomerBalanceFundsAvailable", () => {
  it("states the balance and nothing about its cause: the reason is always the general one", async () => {
    const { deps, record, find, groups } = setup([group({ status: "paid" })]);
    const result = await handleCustomerBalanceFundsAvailable(
      deps,
      event,
      balance({ gbp: 29_900 }),
      groups,
    );
    expect(result).toEqual({ processed: true, action: "customer_balance_unapplied" });
    expect(find).toHaveBeenCalledWith("cus_Rk3TestBuyer", expect.any(Date));
    const since = (find.mock.calls[0] as unknown as [string, Date])[1];
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(
      POSSIBLE_SOURCE_LOOKBACK_MS - 5_000,
    );
    expect(record).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      {
        reason: "customer_balance_unapplied",
        paymentId: null,
        paymentGroupId: null,
        possibleGroup: { id: "group-1", status: "paid" },
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeCustomerId: "cus_Rk3TestBuyer",
        stripeEventId: "evt_1QcashFunds:gbp",
        amountCents: 29_900,
        currency: "gbp",
      },
      null,
    );
  });

  it("suggests an open or processing payment as a possible owner, without calling it an overpayment", async () => {
    for (const status of ["open", "processing"] as const) {
      const { deps, record, groups } = setup([group({ status })]);
      await handleCustomerBalanceFundsAvailable(deps, event, balance({ gbp: 5_000 }), groups);
      expect(recorded(record)).toMatchObject({
        reason: "customer_balance_unapplied",
        paymentGroupId: null,
        possibleGroup: { id: "group-1", status },
      });
    }
  });

  it("suggests nothing when two payments could explain it", async () => {
    const { deps, record, groups } = setup([
      group({ id: "group-1" }),
      group({ id: "group-2", status: "paid" }),
    ]);
    await handleCustomerBalanceFundsAvailable(deps, event, balance({ gbp: 5_000 }), groups);
    expect(recorded(record)).toMatchObject({
      reason: "customer_balance_unapplied",
      possibleGroup: null,
    });
  });

  it("suggests nothing when the buyer has no recent bank-transfer payment, or none in this currency", async () => {
    const none = setup([]);
    await handleCustomerBalanceFundsAvailable(none.deps, event, balance({ gbp: 100 }), none.groups);
    expect(recorded(none.record)).toMatchObject({ possibleGroup: null });
    const other = setup([group()]);
    await handleCustomerBalanceFundsAvailable(
      other.deps,
      event,
      balance({ eur: 5_000 }),
      other.groups,
    );
    expect(recorded(other.record)).toMatchObject({ possibleGroup: null, currency: "eur" });
  });

  it("reports the whole balance each time, so money already in the balance is not taken for this transfer", async () => {
    // A leftover of £100 was there; a later transfer takes the balance to £350. The event says only
    // that the balance is £350: that is what is stored, as a new task for the same customer (the
    // earlier open one is superseded by the recorder), with the one paid payment only suggested.
    const first = setup([group({ status: "paid" })]);
    await handleCustomerBalanceFundsAvailable(
      first.deps,
      { ...event, id: "evt_first" } as Stripe.Event,
      balance({ gbp: 10_000 }),
      first.groups,
    );
    const second = setup([group({ status: "paid" })]);
    await handleCustomerBalanceFundsAvailable(
      second.deps,
      { ...event, id: "evt_second" } as Stripe.Event,
      balance({ gbp: 35_000 }),
      second.groups,
    );
    expect(recorded(first.record)).toMatchObject({
      amountCents: 10_000,
      stripeEventId: "evt_first:gbp",
      reason: "customer_balance_unapplied",
    });
    expect(recorded(second.record)).toMatchObject({
      amountCents: 35_000,
      stripeEventId: "evt_second:gbp",
      reason: "customer_balance_unapplied",
      paymentGroupId: null,
    });
  });

  it("works without the group lookup, as before", async () => {
    const { deps, record } = setup([group()]);
    await handleCustomerBalanceFundsAvailable(deps, event, balance({ gbp: 100 }));
    expect(recorded(record)).toMatchObject({
      reason: "customer_balance_unapplied",
      possibleGroup: null,
    });
  });

  it("raises nothing when nothing is left in the balance", async () => {
    const { deps, record, groups } = setup([group()]);
    const result = await handleCustomerBalanceFundsAvailable(
      deps,
      event,
      balance({ gbp: 0 }),
      groups,
    );
    expect(result).toEqual({ processed: true, action: "skipped", reason: "no_balance_left" });
    expect(record).not.toHaveBeenCalled();
  });
});

describe("possibleSourceGroup", () => {
  it("names the only candidate that fits the currency, case aside", () => {
    expect(possibleSourceGroup([group({ currency: "GBP" })], "gbp")).toEqual({
      id: "group-1",
      status: "processing",
    });
  });

  it("names none for no candidate, two candidates, or a cancelled one", () => {
    expect(possibleSourceGroup([], "gbp")).toBeNull();
    expect(possibleSourceGroup([group(), group({ id: "group-2" })], "gbp")).toBeNull();
    expect(possibleSourceGroup([group({ status: "cancelled" })], "gbp")).toBeNull();
  });
});
