import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryClaimProcessedStripeEvent } from "../../../lib/stripe-processed-event.js";
import { ConnectBankChangeHandler } from "./connect-bank-change.handler.js";

vi.mock("../../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn(),
}));

const ENTITY = "00000000-0000-4000-8000-000000000001";

function bankEvent(overrides: Partial<Stripe.BankAccount> = {}, account = "acct_1"): Stripe.Event {
  return {
    id: "evt_bank_1",
    type: "account.external_account.updated",
    account,
    data: {
      object: {
        object: "bank_account",
        last4: "4242",
        bank_name: "STRIPE TEST BANK",
        default_for_currency: true,
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

function setup(
  entity: { id: string; displayName: string } | null = {
    id: ENTITY,
    displayName: "Northbank Gallery",
  },
) {
  const published: unknown[] = [];
  const sink = {
    publish: vi.fn(async (event: unknown) => {
      published.push(event);
    }),
    withTx: () => sink,
  };
  const notifier = { bankChanged: vi.fn(async () => undefined) };
  const handler = new ConnectBankChangeHandler({
    transactionRunner: { runInTransaction: (fn) => fn({} as never) },
    accounts: { findLegalEntityRowByStripeAccountId: vi.fn(async () => entity as never) },
    events: sink as never,
    notifier,
  });
  return { handler, published, notifier };
}

describe("ConnectBankChangeHandler", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it("records the change in Activity and tells the organisation", async () => {
    const { handler, published, notifier } = setup();
    expect(await handler.handle(bankEvent())).toEqual({ processed: true });
    expect(published).toEqual([
      expect.objectContaining({
        aggregateType: "legal_entity",
        aggregateId: ENTITY,
        eventType: "legal_entity.payout_bank_changed",
        payload: { bank_last4: "4242", bank_name: "STRIPE TEST BANK" },
        actingLegalEntityId: ENTITY,
      }),
    ]);
    expect(notifier.bankChanged).toHaveBeenCalledWith({
      legalEntityId: ENTITY,
      organisationName: "Northbank Gallery",
      bankLast4: "4242",
    });
  });

  it("handles each Stripe event once", async () => {
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: false });
    const { handler, published, notifier } = setup();
    expect(await handler.handle(bankEvent())).toEqual({ processed: true });
    expect(published).toEqual([]);
    expect(notifier.bankChanged).not.toHaveBeenCalled();
  });

  it("ignores accounts payouts do not go to, cards and unknown accounts", async () => {
    const { handler, notifier } = setup();
    expect(await handler.handle(bankEvent({ default_for_currency: false }))).toEqual({
      processed: false,
    });
    expect(await handler.handle(bankEvent({ object: "card" as never }))).toEqual({
      processed: false,
    });
    const unknown = setup(null);
    expect(await unknown.handler.handle(bankEvent())).toEqual({ processed: false });
    expect(notifier.bankChanged).not.toHaveBeenCalled();
  });
});
