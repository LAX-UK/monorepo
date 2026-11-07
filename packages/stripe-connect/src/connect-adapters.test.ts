import { describe, expect, it, vi } from "vitest";
import {
  connectSessionComponents,
  createConnectAccountSession,
  createConnectOnboardingLink,
  createConnectTransfer,
  findExistingConnectTransfer,
  platformCollectedConnectController,
} from "./connect-adapters.js";

describe("platformCollectedConnectController", () => {
  it("keeps requirement collection on the platform with no Stripe dashboard", () => {
    expect(platformCollectedConnectController()).toEqual({
      fees: { payer: "application" },
      losses: { payments: "application" },
      requirement_collection: "application",
      stripe_dashboard: { type: "none" },
    });
  });
});

describe("connectSessionComponents", () => {
  it("returns onboarding components", () => {
    expect(connectSessionComponents("onboarding")).toEqual({
      account_onboarding: { enabled: true },
      notification_banner: { enabled: true },
    });
  });

  it("returns management components with bank account collection", () => {
    expect(connectSessionComponents("management")).toEqual({
      account_management: { enabled: true, features: { external_account_collection: true } },
      notification_banner: { enabled: true },
      balances: { enabled: true },
    });
  });

  it("returns a fresh object per call", () => {
    expect(connectSessionComponents("onboarding")).not.toBe(connectSessionComponents("onboarding"));
  });
});

describe("createConnectAccountSession", () => {
  it("returns the client secret", async () => {
    const create = vi.fn().mockResolvedValue({ client_secret: "cs_1" });
    const secret = await createConnectAccountSession(
      { accountSessions: { create } },
      { accountId: "acct_1", components: { notification_banner: { enabled: true } } },
    );
    expect(secret).toBe("cs_1");
    expect(create).toHaveBeenCalledWith({
      account: "acct_1",
      components: { notification_banner: { enabled: true } },
    });
  });

  it("returns null when Stripe omits the secret", async () => {
    const create = vi.fn().mockResolvedValue({ client_secret: null });
    await expect(
      createConnectAccountSession(
        { accountSessions: { create } },
        { accountId: "a", components: {} },
      ),
    ).resolves.toBeNull();
  });
});

describe("createConnectOnboardingLink", () => {
  it("maps expires_at seconds to a Date", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://connect", expires_at: 1_700_000_000 });
    const link = await createConnectOnboardingLink(
      { accountLinks: { create } },
      { accountId: "acct_1", returnUrl: "https://a/r", refreshUrl: "https://a/f" },
    );
    expect(link).toEqual({ url: "https://connect", expiresAt: new Date(1_700_000_000_000) });
    expect(create).toHaveBeenCalledWith({
      account: "acct_1",
      type: "account_onboarding",
      return_url: "https://a/r",
      refresh_url: "https://a/f",
    });
  });
});

describe("createConnectTransfer", () => {
  it("lower-cases currency and forwards the idempotency key", async () => {
    const create = vi.fn().mockResolvedValue({ id: "tr_1" });
    await createConnectTransfer(
      { transfers: { create } },
      {
        amountMinor: 1200,
        currency: "GBP",
        destinationAccountId: "acct_1",
        transferGroup: "payout:p1",
        metadata: { payoutId: "p1" },
        idempotencyKey: "payout:transfer:p1",
      },
    );
    expect(create).toHaveBeenCalledWith(
      {
        amount: 1200,
        currency: "gbp",
        destination: "acct_1",
        transfer_group: "payout:p1",
        metadata: { payoutId: "p1" },
      },
      { idempotencyKey: "payout:transfer:p1" },
    );
  });

  it("includes source_transaction only when provided", async () => {
    const create = vi.fn().mockResolvedValue({ id: "tr_2" });
    await createConnectTransfer(
      { transfers: { create } },
      {
        amountMinor: 1,
        currency: "gbp",
        destinationAccountId: "acct_1",
        transferGroup: "g",
        sourceChargeId: "ch_1",
        metadata: {},
        idempotencyKey: "k",
      },
    );
    expect(create.mock.calls[0]?.[0]).toMatchObject({ source_transaction: "ch_1" });
  });
});

describe("findExistingConnectTransfer", () => {
  const input = { transferGroup: "payout:p1", destinationAccountId: "acct_1", payoutId: "p1" };
  const client = (data: unknown[]) => ({
    transfers: { list: vi.fn().mockResolvedValue({ data }) },
  });

  it("looks up by transfer group and adopts a live matching transfer", async () => {
    const c = client([
      { id: "tr_rev", destination: "acct_1", reversed: true, metadata: { payoutId: "p1" } },
      { id: "tr_other", destination: "acct_2", metadata: { payoutId: "p1" } },
      { id: "tr_ok", destination: { id: "acct_1" }, metadata: { payoutId: "p1" } },
    ]);
    await expect(findExistingConnectTransfer(c as never, input)).resolves.toEqual({ id: "tr_ok" });
    expect(c.transfers.list).toHaveBeenCalledWith({ transfer_group: "payout:p1", limit: 20 });
  });

  it("returns null when nothing matches", async () => {
    const c = client([{ id: "tr_x", destination: "acct_1", metadata: { payoutId: "p2" } }]);
    await expect(findExistingConnectTransfer(c as never, input)).resolves.toBeNull();
  });
});
