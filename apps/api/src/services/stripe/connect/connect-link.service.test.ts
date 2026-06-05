import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../env.js";
import { ConnectLinkService } from "./connect-link.service.js";

function baseEnv(): Env {
  return {
    WEB_ORIGIN: "https://lax.bid",
    NODE_ENV: "production",
    LOG_LEVEL: "info",
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_PUBLISHABLE_KEY: "pk_test",
  } as Env;
}

describe("ConnectLinkService", () => {
  it("rejects onboarding links from untrusted origins in production", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "le1", stripeConnectAccountId: "acct_1" }]),
          }),
        }),
      }),
    };
    const stripeFactory = {
      get: () => ({ accountLinks: { create: vi.fn() } }),
    };
    const svc = new ConnectLinkService(baseEnv(), db as never, stripeFactory as never);

    await expect(
      svc.createOnboardingLink("le1", "https://evil.test/return", "https://lax.bid/refresh"),
    ).rejects.toThrow("connect_url_origin_not_allowed");
  });

  it("throws stripe_account_missing when entity has no Connect account", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "le1", stripeConnectAccountId: null }]),
          }),
        }),
      }),
    };
    const stripeFactory = { get: () => ({ accounts: { createLoginLink: vi.fn() } }) };
    const svc = new ConnectLinkService(baseEnv(), db as never, stripeFactory as never);

    await expect(svc.createDashboardLink("le1")).rejects.toMatchObject({
      code: "stripe_account_missing",
    });
  });
});
