import type { Database } from "@auction/db";
import type { ILegalEntityConnectRepository } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../env.js";
import { transactionRunnerFromDb } from "../../../test/transaction-runner-from-db.js";
import { ConnectAccountService } from "./connect-account.service.js";
import type { ConnectLifecyclePromoter } from "./connect-lifecycle-promoter.js";

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
