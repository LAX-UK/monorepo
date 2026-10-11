import { describe, expect, it, vi } from "vitest";
import type { ShopConnectGateway } from "../../../application/ports/shop-connect.gateway.js";
import type { ShopPayeeConnectAccountRepository } from "../../drizzle-shop-payee-connect-account.repository.js";
import { createSyncConnectAccountHandler } from "./sync-connect-account.handler.js";

const liveFlags = {
  stripeAccountId: "acct_1",
  chargesEnabled: false,
  payoutsEnabled: true,
  requirementsCurrentlyDue: [],
  disabledReason: null,
};

function setup(applied: boolean) {
  const gateway = { retrieveAccountFlags: vi.fn().mockResolvedValue(liveFlags) };
  const accounts = { applyFlags: vi.fn().mockResolvedValue(applied) };
  const handler = createSyncConnectAccountHandler({
    gateway: gateway as unknown as ShopConnectGateway,
    accounts: accounts as unknown as ShopPayeeConnectAccountRepository,
  });
  return { gateway, accounts, handler };
}

describe("createSyncConnectAccountHandler", () => {
  it("re-reads the account from Stripe instead of trusting the event payload", async () => {
    const { gateway, accounts, handler } = setup(true);
    const outcome = await handler({
      type: "account.updated",
      data: { object: { id: "acct_1", payouts_enabled: false } },
    });
    expect(outcome).toBe("applied");
    expect(gateway.retrieveAccountFlags).toHaveBeenCalledWith("acct_1");
    expect(accounts.applyFlags).toHaveBeenCalledWith(liveFlags);
  });

  it("reports accounts unknown on this platform as orphans", async () => {
    const { handler } = setup(false);
    await expect(
      handler({ type: "account.updated", data: { object: { id: "acct_1" } } }),
    ).resolves.toBe("orphan");
  });

  it("ignores other event types without calling Stripe", async () => {
    const { gateway, handler } = setup(true);
    await expect(handler({ type: "payout.paid", data: { object: { id: "po_1" } } })).resolves.toBe(
      "ignored",
    );
    expect(gateway.retrieveAccountFlags).not.toHaveBeenCalled();
  });
});
