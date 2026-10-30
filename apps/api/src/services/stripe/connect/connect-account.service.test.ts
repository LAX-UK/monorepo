import type { Database } from "@auction/db";
import type { ILegalEntityConnectRepository } from "@auction/persistence/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../env.js";
import { transactionRunnerFromDb } from "../../../test/transaction-runner-from-db.js";
import { ConnectAccountService } from "./connect-account.service.js";
import type { ConnectLifecyclePromoter } from "./connect-lifecycle-promoter.js";

vi.mock("./connect-account-prefill.js", () => ({
  buildOrganisationConnectAccountParams: () => ({ type: "custom" }),
  buildIndividualConnectAccountParams: () => ({ type: "custom" }),
}));
vi.mock("./connect-country-resolver.js", () => ({ resolveConnectAccountCountry: () => "GB" }));
vi.mock("../../../lib/legal-entity-row-mapper.js", () => ({
  legalEntityRowToDomain: (row: { id: string }) => ({ id: row.id }),
}));

function baseEnv(): Pick<Env, "LOG_LEVEL" | "NODE_ENV"> {
  return { LOG_LEVEL: "info", NODE_ENV: "test" };
}

const lifecyclePromoter = {
  applyStripeAccountFlags: vi.fn(),
} as unknown as ConnectLifecyclePromoter;

describe("ConnectAccountService.getStatus", () => {
  it("returns cached DB flags without calling Stripe", async () => {
    const row = {
      id: "le1",
      stripeConnectAccountId: "acct_1",
      stripeConnectPayoutsEnabled: true,
      stripeConnectChargesEnabled: true,
      stripeConnectRequirementsCurrentlyDue: [],
      stripeConnectDisabledReason: null,
    };
    const connectReader = {
      findLegalEntityRowById: vi.fn().mockResolvedValue(row),
    };
    const connectRepository = {} as ILegalEntityConnectRepository;
    const db = {} as Database;
    const stripeFactory = {
      get: vi.fn().mockReturnValue({
        accounts: { retrieve: vi.fn() },
      }),
      require: vi.fn(),
    };

    const svc = new ConnectAccountService(
      baseEnv(),
      transactionRunnerFromDb(db),
      connectReader as never,
      connectRepository,
      stripeFactory as never,
      lifecyclePromoter,
    );
    const status = await svc.getStatus("le1");

    expect(status.stripeAccountId).toBe("acct_1");
    expect(status.ready).toBe(true);
    expect(status.syncDegraded).toBeUndefined();
    expect(stripeFactory.get).not.toHaveBeenCalled();
  });
});

/** What Stripe answers for an account id this platform cannot see (a seeded or deleted id). */
function unknownAccountError() {
  return Object.assign(new Error("No such account"), {
    type: "StripePermissionError",
    code: "account_invalid",
  });
}

function serviceWith(row: Record<string, unknown>, retrieve: ReturnType<typeof vi.fn>) {
  const create = vi.fn().mockResolvedValue({ id: "acct_new" });
  const connectReader = {
    findLegalEntityRowById: vi.fn().mockResolvedValue(row),
    findLegalEntityRowByStripeAccountId: vi.fn().mockResolvedValue(row),
    loadAccountCreationContext: vi.fn().mockResolvedValue({
      entity: row,
      ownerKycStatus: "approved",
      entityAddress: null,
      userAddress: null,
      kyc: null,
    }),
  };
  const persistConnectAccount = vi.fn(async (input: { stripeAccountId: string }) => ({
    ...row,
    stripeConnectAccountId: input.stripeAccountId,
  }));
  const svc = new ConnectAccountService(
    baseEnv(),
    transactionRunnerFromDb({} as Database),
    connectReader as never,
    { persistConnectAccount } as unknown as ILegalEntityConnectRepository,
    { get: vi.fn().mockReturnValue({ accounts: { retrieve, create } }), require: vi.fn() } as never,
    lifecyclePromoter,
  );
  return { svc, create, persistConnectAccount };
}

describe("ConnectAccountService with an account Stripe does not know", () => {
  const row = {
    id: "le1",
    kind: "organisation",
    status: "active",
    stripeConnectAccountId: "acct_seed_fake",
    stripeConnectPayoutsEnabled: false,
    stripeConnectChargesEnabled: false,
    stripeConnectRequirementsCurrentlyDue: [],
    stripeConnectDisabledReason: null,
  };

  beforeEach(() => vi.clearAllMocks());

  it("reads as payouts not set up instead of failing to load", async () => {
    const { svc } = serviceWith(row, vi.fn().mockRejectedValue(unknownAccountError()));
    const status = await svc.syncAccountFromStripe("le1");
    expect(status).toMatchObject({ stripeAccountId: null, ready: false, payoutsEnabled: false });
  });

  it("still fails on any other Stripe error", async () => {
    const outage = Object.assign(new Error("Stripe is down"), { type: "StripeAPIError" });
    const { svc } = serviceWith(row, vi.fn().mockRejectedValue(outage));
    await expect(svc.syncAccountFromStripe("le1")).rejects.toBe(outage);
  });

  it("sets up a new account in place of the unknown one", async () => {
    const { svc, create, persistConnectAccount } = serviceWith(
      row,
      vi.fn().mockRejectedValue(unknownAccountError()),
    );
    const result = await svc.ensureAccount("le1");
    expect(result.stripeAccountId).toBe("acct_new");
    expect(create).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: "connect:account:v4:le1:replaces:acct_seed_fake",
    });
    expect(persistConnectAccount).toHaveBeenCalledWith(
      expect.objectContaining({ legalEntityId: "le1", stripeAccountId: "acct_new" }),
    );
  });

  it("keeps an account Stripe knows", async () => {
    const { svc, create } = serviceWith(row, vi.fn().mockResolvedValue({ id: "acct_seed_fake" }));
    const result = await svc.ensureAccount("le1");
    expect(result.stripeAccountId).toBe("acct_seed_fake");
    expect(create).not.toHaveBeenCalled();
  });
});
