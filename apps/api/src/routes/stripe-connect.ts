import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { StripeConnectNotConfiguredError } from "../services/interfaces/stripe-connect.js";

const ensureBodySchema = z.object({
  country: z.string().length(2).default("GB"),
});

const linkBodySchema = z.object({
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});

export function createStripeConnectRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  /** GET /stripe-connect/status — Connect status for the acting legal entity.
   * Available to any active member of the entity.
   */
  r.get("/status", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const status = await container.stripeConnectService.getStatus(ctx.legalEntityId);
    return c.json({ data: status });
  });

  /** POST /stripe-connect/account — create (or look up) the Express account.
   * Owner / admin only.
   */
  r.post(
    "/account",
    requireAuth,
    requireContext,
    zValidator("json", ensureBodySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      if (ctx.role !== "owner" && ctx.role !== "admin") {
        return c.json({ error: "insufficient_role" }, 403);
      }
      const body = c.req.valid("json");
      try {
        const result = await container.stripeConnectService.ensureAccount(
          ctx.legalEntityId,
          body.country,
        );
        return c.json({ data: result }, 201);
      } catch (err) {
        if (err instanceof StripeConnectNotConfiguredError) {
          return c.json({ error: "stripe_not_configured" }, 503);
        }
        if (err instanceof Error && err.message === "kyc_not_approved") {
          return c.json({ error: "kyc_not_approved" }, 403);
        }
        throw err;
      }
    },
  );

  /** POST /stripe-connect/onboarding-link — short-lived hosted onboarding URL. */
  r.post(
    "/onboarding-link",
    requireAuth,
    requireContext,
    zValidator("json", linkBodySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      if (ctx.role !== "owner" && ctx.role !== "admin") {
        return c.json({ error: "insufficient_role" }, 403);
      }
      const body = c.req.valid("json");
      try {
        const link = await container.stripeConnectService.createOnboardingLink(
          ctx.legalEntityId,
          body.returnUrl,
          body.refreshUrl,
        );
        return c.json({ data: link });
      } catch (err) {
        if (err instanceof StripeConnectNotConfiguredError) {
          return c.json({ error: "stripe_not_configured" }, 503);
        }
        if (err instanceof Error && err.message.startsWith("connect_url_")) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    },
  );

  /** POST /stripe-connect/dashboard-link — short-lived Stripe Express dashboard URL. */
  r.post("/dashboard-link", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    if (ctx.role !== "owner" && ctx.role !== "admin" && ctx.role !== "finance") {
      return c.json({ error: "insufficient_role" }, 403);
    }
    try {
      const link = await container.stripeConnectService.createDashboardLink(ctx.legalEntityId);
      return c.json({ data: link });
    } catch (err) {
      if (err instanceof StripeConnectNotConfiguredError) {
        return c.json({ error: "stripe_not_configured" }, 503);
      }
      throw err;
    }
  });

  return r;
}
