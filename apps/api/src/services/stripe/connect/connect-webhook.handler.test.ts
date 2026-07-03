import type { Database } from "@auction/db";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../../../lib/stripe-processed-event.js";
import { transactionRunnerFromDb } from "../../../test/transaction-runner-from-db.js";
import type { ConnectAccountService } from "./connect-account.service.js";
import { ConnectWebhookHandler } from "./connect-webhook.handler.js";

vi.mock("../../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn().mockResolvedValue({ claimed: true }),
}));

function makeTransactionDb(inner: Database = {} as Database): Database {
  return {
    transaction: vi.fn(async (fn: (tx: Database) => Promise<unknown>) => fn(inner)),
  } as unknown as Database;
}

describe("ConnectWebhookHandler.handleConnectedAccountEvent", () => {
  beforeEach(() => {
    vi.mocked(tryClaimProcessedStripeEvent).mockReset();
    vi.mocked(tryClaimProcessedStripeEvent).mockResolvedValue({ claimed: true });
  });

  it("re-fetches account on account.updated instead of applying stale event payload", async () => {
    const staleAccount = {
      id: "acct_1",
      charges_enabled: true,
      payouts_enabled: true,
      requirements: { currently_due: [] },
    } as unknown as Stripe.Account;
    const freshAccount = {
      id: "acct_1",
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: ["external_account"] },
    } as unknown as Stripe.Account;
    const accountsRetrieve = vi.fn().mockResolvedValue(freshAccount);
    const stripeFactory: IStripeClientFactory = {
      get: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
      require: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
    };
    const applyAccountUpdate = vi.fn().mockResolvedValue(undefined);
    const accountService = { applyAccountUpdate } as unknown as ConnectAccountService;
    const handler = new ConnectWebhookHandler(
      transactionRunnerFromDb(makeTransactionDb()),
      stripeFactory,
      accountService,
    );

    const result = await handler.handleConnectedAccountEvent({
      id: "evt_acct_1",
      type: "account.updated",
      data: { object: staleAccount },
    } as Stripe.Event);

    expect(result).toEqual({ processed: true });
    expect(accountsRetrieve).toHaveBeenCalledWith("acct_1");
    expect(applyAccountUpdate).toHaveBeenCalledWith(freshAccount, expect.anything());
    expect(applyAccountUpdate).not.toHaveBeenCalledWith(staleAccount, expect.anything());
  });

  it("re-fetches account on capability.updated", async () => {
    const freshAccount = {
      id: "acct_2",
      charges_enabled: false,
      payouts_enabled: true,
      requirements: { currently_due: [] },
    } as unknown as Stripe.Account;
    const accountsRetrieve = vi.fn().mockResolvedValue(freshAccount);
    const stripeFactory: IStripeClientFactory = {
      get: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
      require: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
    };
    const applyAccountUpdate = vi.fn().mockResolvedValue(undefined);
    const accountService = { applyAccountUpdate } as unknown as ConnectAccountService;
    const handler = new ConnectWebhookHandler(
      transactionRunnerFromDb(makeTransactionDb()),
      stripeFactory,
      accountService,
    );

    const result = await handler.handleConnectedAccountEvent({
      id: "evt_cap_1",
      type: "capability.updated",
      data: { object: { account: "acct_2" } },
    } as Stripe.Event);

    expect(result).toEqual({ processed: true });
    expect(accountsRetrieve).toHaveBeenCalledWith("acct_2");
    expect(applyAccountUpdate).toHaveBeenCalledWith(freshAccount, expect.anything());
  });

  it("retrieves account before opening the database transaction", async () => {
    const freshAccount = {
      id: "acct_3",
      charges_enabled: false,
      payouts_enabled: true,
      requirements: { currently_due: [] },
    } as unknown as Stripe.Account;
    let retrieveStarted = false;
    let transactionStarted = false;
    const accountsRetrieve = vi.fn(async () => {
      retrieveStarted = true;
      expect(transactionStarted).toBe(false);
      return freshAccount;
    });
    const stripeFactory: IStripeClientFactory = {
      get: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
      require: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
    };
    const applyAccountUpdate = vi.fn().mockResolvedValue(undefined);
    const accountService = { applyAccountUpdate } as unknown as ConnectAccountService;
    const db = {
      transaction: vi.fn(async (fn: (tx: Database) => Promise<unknown>) => {
        transactionStarted = true;
        expect(retrieveStarted).toBe(true);
        return fn({} as Database);
      }),
    } as unknown as Database;
    const handler = new ConnectWebhookHandler(
      transactionRunnerFromDb(db),
      stripeFactory,
      accountService,
    );

    await handler.handleConnectedAccountEvent({
      id: "evt_acct_3",
      type: "account.updated",
      data: { object: { id: "acct_3" } },
    } as Stripe.Event);

    expect(accountsRetrieve).toHaveBeenCalledWith("acct_3");
    expect(db.transaction).toHaveBeenCalled();
  });

  it("handles account.application.deauthorized without retrieving account", async () => {
    const accountsRetrieve = vi.fn();
    const stripeFactory: IStripeClientFactory = {
      get: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
      require: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
    };
    const applyAccountDeauthorized = vi.fn().mockResolvedValue(undefined);
    const accountService = {
      applyAccountDeauthorized,
      applyAccountUpdate: vi.fn(),
    } as unknown as ConnectAccountService;
    const handler = new ConnectWebhookHandler(
      transactionRunnerFromDb(makeTransactionDb()),
      stripeFactory,
      accountService,
    );

    const result = await handler.handleConnectedAccountEvent({
      id: "evt_deauth_1",
      type: "account.application.deauthorized",
      account: "acct_deauth",
      data: { object: {} },
    } as Stripe.Event);

    expect(result).toEqual({ processed: true });
    expect(accountsRetrieve).not.toHaveBeenCalled();
    expect(applyAccountDeauthorized).toHaveBeenCalledWith("acct_deauth", expect.anything());
  });

  it("does not claim idempotency when accounts.retrieve fails", async () => {
    const accountsRetrieve = vi.fn().mockRejectedValue(new Error("stripe down"));
    const stripeFactory: IStripeClientFactory = {
      get: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
      require: () => ({ accounts: { retrieve: accountsRetrieve } }) as unknown as Stripe,
    };
    const transaction = vi.fn();
    const db = { transaction } as unknown as Database;
    const handler = new ConnectWebhookHandler(transactionRunnerFromDb(db), stripeFactory, {
      applyAccountUpdate: vi.fn(),
    } as unknown as ConnectAccountService);

    await expect(
      handler.handleConnectedAccountEvent({
        id: "evt_acct_fail",
        type: "account.updated",
        data: { object: { id: "acct_fail" } },
      } as Stripe.Event),
    ).rejects.toThrow("stripe down");

    expect(transaction).not.toHaveBeenCalled();
    expect(tryClaimProcessedStripeEvent).not.toHaveBeenCalled();
  });
});
