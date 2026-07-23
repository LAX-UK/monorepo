import { Hono } from "hono";
import { z } from "zod";
import type { ContainerStripeConnectRoutesSlice } from "../container.js";
import { respondFinanceHttpJson } from "../lib/finance-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

/** Country is derived server-side (immutable on Stripe accounts); body is ignored. */
const ensureBodySchema = z.object({}).optional().default({});

const linkBodySchema = z.object({
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});

const sessionBodySchema = z.object({
  surface: z.enum(["onboarding", "management"]).default("onboarding"),
});

function connectCtx(c: { get: (key: "legalEntityContext") => LegalEntityContext | undefined }) {
  const ctx = c.get("legalEntityContext") as LegalEntityContext;
  return { legalEntityId: ctx.legalEntityId, role: ctx.role };
}

export function createStripeConnectRoutes(
  container: ContainerStripeConnectRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const stripeConnectHttp = container.finance.stripeConnectHttp;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  r.get("/client-config", requireAuth, async (c) => {
    const response = await stripeConnectHttp.getClientConfig();
    return respondFinanceHttpJson(c, response);
  });

  r.get("/status", requireAuth, requireContext, async (c) => {
    const response = await stripeConnectHttp.getStatus(connectCtx(c));
    return respondFinanceHttpJson(c, response);
  });

  r.post("/sync", requireAuth, requireContext, async (c) => {
    const response = await stripeConnectHttp.syncAccountFromStripe(connectCtx(c));
    return respondFinanceHttpJson(c, response);
  });

  r.post(
    "/account-session",
    requireAuth,
    requireContext,
    zValidator("json", sessionBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const response = await stripeConnectHttp.createAccountSession(connectCtx(c), body.surface);
      return respondFinanceHttpJson(c, response);
    },
  );

  r.post(
    "/account",
    requireAuth,
    requireContext,
    zValidator("json", ensureBodySchema),
    async (c) => {
      const response = await stripeConnectHttp.ensureAccount(connectCtx(c));
      return respondFinanceHttpJson(c, response);
    },
  );

  r.post(
    "/onboarding-link",
    requireAuth,
    requireContext,
    zValidator("json", linkBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const response = await stripeConnectHttp.createOnboardingLink(
        connectCtx(c),
        body.returnUrl,
        body.refreshUrl,
      );
      return respondFinanceHttpJson(c, response);
    },
  );

  r.post("/dashboard-link", requireAuth, requireContext, async (c) => {
    const response = await stripeConnectHttp.createDashboardLink(connectCtx(c));
    return respondFinanceHttpJson(c, response);
  });

  return r;
}
