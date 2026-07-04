import type { ILegalEntityConnectReader } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { ConnectSessionService } from "./connect-session.service.js";

function makeReader(row: { id: string; stripeConnectAccountId: string | null } | null) {
  return {
    findLegalEntityRowById: vi.fn().mockResolvedValue(row),
  } as unknown as ILegalEntityConnectReader;
}

describe("ConnectSessionService", () => {
  const stripe = {
    accountSessions: {
      create: vi.fn().mockResolvedValue({ client_secret: "cs_test" }),
    },
  };

  const stripeFactory = {
    get: vi.fn().mockReturnValue(stripe),
    require: vi.fn().mockReturnValue(stripe),
  };

  it("returns client config with enforcement flag", () => {
    const svc = new ConnectSessionService(
      { STRIPE_PUBLISHABLE_KEY: "pk_test" } as never,
      makeReader(null),
      stripeFactory,
    );
    expect(svc.getClientConfig()).toEqual({
      publishableKey: "pk_test",
      connectEnforced: true,
    });
  });

  it("returns null publishable key when unset", () => {
    const svc = new ConnectSessionService(
      { STRIPE_PUBLISHABLE_KEY: undefined } as never,
      makeReader(null),
      stripeFactory,
    );
    expect(svc.getClientConfig()).toEqual({
      publishableKey: null,
      connectEnforced: true,
    });
  });

  it("builds onboarding session for owner", async () => {
    const svc = new ConnectSessionService(
      { STRIPE_PUBLISHABLE_KEY: "pk_test" } as never,
      makeReader({ id: "entity-1", stripeConnectAccountId: "acct_123" }),
      stripeFactory,
    );
    const result = await svc.createAccountSession("entity-1", "owner", "onboarding");
    expect(result.clientSecret).toBe("cs_test");
    expect(stripe.accountSessions.create).toHaveBeenCalledWith({
      account: "acct_123",
      components: {
        account_onboarding: { enabled: true },
        notification_banner: { enabled: true },
      },
    });
  });

  it("rejects finance role on onboarding surface", async () => {
    const svc = new ConnectSessionService(
      { STRIPE_PUBLISHABLE_KEY: "pk_test" } as never,
      makeReader({ id: "entity-1", stripeConnectAccountId: "acct_123" }),
      stripeFactory,
    );
    await expect(svc.createAccountSession("entity-1", "finance", "onboarding")).rejects.toThrow(
      "insufficient_role",
    );
  });

  it("rejects member role on management surface", async () => {
    const svc = new ConnectSessionService(
      { STRIPE_PUBLISHABLE_KEY: "pk_test" } as never,
      makeReader({ id: "entity-1", stripeConnectAccountId: "acct_123" }),
      stripeFactory,
    );
    await expect(svc.createAccountSession("entity-1", "member", "management")).rejects.toThrow(
      "insufficient_role",
    );
  });

  it("builds management session for finance", async () => {
    const svc = new ConnectSessionService(
      { STRIPE_PUBLISHABLE_KEY: "pk_test" } as never,
      makeReader({ id: "entity-1", stripeConnectAccountId: "acct_123" }),
      stripeFactory,
    );
    await svc.createAccountSession("entity-1", "finance", "management");
    expect(stripe.accountSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.objectContaining({
          account_management: expect.objectContaining({ enabled: true }),
        }),
      }),
    );
  });

  it("throws legal_entity_not_found", async () => {
    const svc = new ConnectSessionService(
      { STRIPE_PUBLISHABLE_KEY: "pk_test" } as never,
      makeReader(null),
      stripeFactory,
    );
    await expect(svc.createAccountSession("missing", "owner", "onboarding")).rejects.toThrow(
      "legal_entity_not_found",
    );
  });

  it("throws stripe_account_missing when entity has no account id", async () => {
    const svc = new ConnectSessionService(
      { STRIPE_PUBLISHABLE_KEY: "pk_test" } as never,
      makeReader({ id: "entity-1", stripeConnectAccountId: null }),
      stripeFactory,
    );
    await expect(svc.createAccountSession("entity-1", "owner", "onboarding")).rejects.toThrow(
      "stripe_account_missing",
    );
  });
});
