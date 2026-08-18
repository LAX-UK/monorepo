import type { LegalEntitySummary } from "@auction/types";
import { Hono } from "hono";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { StripeConnectHttpApplicationService } from "../services/finance/stripe-connect-http-application.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import { createStripeConnectRoutes } from "./stripe-connect.js";

const entityId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function mountApp(role: LegalEntitySummary["role"]) {
  const stripeConnectService = {
    getClientConfig: vi.fn().mockReturnValue({ publishableKey: "pk_test", connectEnforced: true }),
    getStatus: vi.fn().mockResolvedValue({ ready: false, stripeAccountId: "acct_1" }),
    syncAccountFromStripe: vi.fn().mockResolvedValue({ ready: true }),
    createAccountSession: vi.fn(async (_id: string, memberRole: string, surface: string) => {
      if (memberRole === "viewer") throw new Error("insufficient_role");
      if (memberRole === "finance" && surface === "onboarding")
        throw new Error("insufficient_role");
      return { clientSecret: "cs_test" };
    }),
    ensureAccount: vi.fn().mockResolvedValue({ stripeAccountId: "acct_1" }),
    createOnboardingLink: vi.fn().mockResolvedValue({ url: "https://stripe.test/link" }),
    createDashboardLink: vi.fn().mockResolvedValue({ url: "https://stripe.test/dashboard" }),
  };

  const legalEntityContext: LegalEntityContext = {
    legalEntityId: entityId,
    role,
    userId: "user-1",
    isPrimaryAdmin: role === "owner",
  };

  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    finance: {
      stripeConnectHttp: new StripeConnectHttpApplicationService(
        stripeConnectService as unknown as IStripeConnectService,
      ),
    },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", legalEntityContext);
      await next();
    },
  } as unknown as Pick<
    Container,
    "userSuspensionChecker" | "finance" | "requireLegalEntityContext"
  >;

  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "user-1", role: "client", scopes: ["bid.write"] }),
  };

  const app = new Hono<{
    Variables: { userId?: string; legalEntityContext?: LegalEntityContext };
  }>();
  app.route("/stripe-connect", createStripeConnectRoutes(container, authenticator));
  return { app, stripeConnectService };
}

describe("stripe-connect routes — role gates", () => {
  it("returns 403 for member on POST /account-session", async () => {
    const { app, stripeConnectService } = mountApp("viewer");
    const res = await app.request("/stripe-connect/account-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: "management" }),
    });
    expect(res.status).toBe(403);
    expect(stripeConnectService.createAccountSession).toHaveBeenCalled();
  });

  it("returns 403 for member on POST /account", async () => {
    const { app, stripeConnectService } = mountApp("viewer");
    const res = await app.request("/stripe-connect/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
    expect(stripeConnectService.ensureAccount).not.toHaveBeenCalled();
  });

  it("returns 403 for member on POST /onboarding-link", async () => {
    const { app, stripeConnectService } = mountApp("viewer");
    const res = await app.request("/stripe-connect/onboarding-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        returnUrl: "https://app.test/dashboard/seller/connect",
        refreshUrl: "https://app.test/dashboard/seller/connect",
      }),
    });
    expect(res.status).toBe(403);
    expect(stripeConnectService.createOnboardingLink).not.toHaveBeenCalled();
  });

  it("returns 403 for finance on onboarding account-session", async () => {
    const { app } = mountApp("finance");
    const res = await app.request("/stripe-connect/account-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: "onboarding" }),
    });
    expect(res.status).toBe(403);
  });

  it("allows finance on management account-session", async () => {
    const { app, stripeConnectService } = mountApp("finance");
    const res = await app.request("/stripe-connect/account-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: "management" }),
    });
    expect(res.status).toBe(200);
    expect(stripeConnectService.createAccountSession).toHaveBeenCalledWith(
      entityId,
      "finance",
      "management",
    );
  });

  it("returns 503 when Stripe platform profile is incomplete on POST /account", async () => {
    const { app, stripeConnectService } = mountApp("owner");
    stripeConnectService.ensureAccount.mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        message:
          "Please review the responsibilities of managing losses for connected accounts at https://dashboard.stripe.com/settings/connect/platform-profile.",
        type: "invalid_request_error",
      } as never),
    );

    const res = await app.request("/stripe-connect/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "stripe_platform_profile_incomplete",
    });
  });
});
