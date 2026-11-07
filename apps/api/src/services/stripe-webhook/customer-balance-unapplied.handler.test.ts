import type { PaymentGroupRecord } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  OVERPAYMENT_LOOKBACK_MS,
  handleCustomerBalanceFundsAvailable,
} from "./customer-balance-unapplied.handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";

vi.mock("../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn(async () => ({ claimed: true })),
}));

/** A recorded `cash_balance.funds_available` object: money left after Stripe applied what it could. */
const balance = (available: Record<string, number>) =>
  ({
    object: "cash_balance",
    customer: "cus_Rk3TestBuyer",
    livemode: false,
    available,
    settings: { reconciliation_mode: "automatic", using_merchant_default: true },
  }) as unknown as Stripe.CashBalance;

const event = { id: "evt_1QcashFunds", type: "cash_balance.funds_available" } as Stripe.Event;

const GROUP: PaymentGroupRecord = {
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
};

function setup(group: PaymentGroupRecord | null) {
  const record = vi.fn(async () => undefined);
  const deps = {
    transactionRunner: { runInTransaction: async (fn: (tx: never) => unknown) => fn({} as never) },
    unappliedMoney: { record },
  } as unknown as StripePaymentWebhookDeps;
  const find = vi.fn(async () => group);
  return { deps, record, find, groups: { findLatestBankTransferGroupForCustomer: find } };
}

describe("handleCustomerBalanceFundsAvailable", () => {
  it("raises the money against the combined payment it overpaid, for finance, with no refund", async () => {
    const { deps, record, find, groups } = setup(GROUP);
    const result = await handleCustomerBalanceFundsAvailable(
      deps,
      event,
      balance({ gbp: 29_900 }),
      groups,
    );
    expect(result).toEqual({ processed: true, action: "customer_balance_unapplied" });
    expect(find).toHaveBeenCalledWith("cus_Rk3TestBuyer", expect.any(Date));
    const since = (find.mock.calls[0] as unknown as [string, Date])[1];
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(OVERPAYMENT_LOOKBACK_MS - 5_000);
    expect(record).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      {
        reason: "group_overpaid",
        paymentId: null,
        paymentGroupId: "group-1",
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeCustomerId: "cus_Rk3TestBuyer",
        stripeEventId: "evt_1QcashFunds:gbp",
        amountCents: 29_900,
        currency: "gbp",
      },
      "org-1",
    );
  });

  it("keeps the general unapplied balance when the buyer has no recent combined payment", async () => {
    const { deps, record, groups } = setup(null);
    await handleCustomerBalanceFundsAvailable(deps, event, balance({ gbp: 250_000 }), groups);
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reason: "customer_balance_unapplied",
        paymentGroupId: null,
        amountCents: 250_000,
      }),
      null,
    );
  });

  it("does not tie money in another currency to the group", async () => {
    const { deps, record, groups } = setup(GROUP);
    await handleCustomerBalanceFundsAvailable(deps, event, balance({ eur: 5_000 }), groups);
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: "customer_balance_unapplied", paymentGroupId: null }),
      null,
    );
  });

  it("works without the group lookup, as before", async () => {
    const { deps, record } = setup(GROUP);
    await handleCustomerBalanceFundsAvailable(deps, event, balance({ gbp: 100 }));
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: "customer_balance_unapplied" }),
      null,
    );
  });

  it("raises nothing when nothing is left in the balance", async () => {
    const { deps, record, groups } = setup(GROUP);
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
