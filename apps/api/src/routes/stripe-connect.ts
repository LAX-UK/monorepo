import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { checkConnectMutationRateLimit } from "../lib/connect-mutation-rate-limit.js";
import { respondStripeConnectRouteError } from "../lib/stripe-connect-route-errors.js";
import { zValidator } from "../lib/z-validator.js";
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

const sessionBodySchema = z.object({
  surface: z.enum(["onboarding", "management"]).default("onboarding"),
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

  r.get("/client-config", requireAuth, async (c) => {
    try {
      return c.json({ data: container.stripeConnectService.getClientConfig() });
    } catch (err) {
      if (err instanceof StripeConnectNotConfiguredError) {
        return c.json({ data: { publishableKey: null, connectEnforced: false } });
      }
      throw err;
    }
  });

  r.get("/status", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    try {
      const status = await container.stripeConnectService.getStatus(ctx.legalEntityId);
      return c.json({ data: status });
    } catch (err) {
      const mapped = respondStripeConnectRouteError(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });

  r.post("/sync", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    if (ctx.role !== "owner" && ctx.role !== "admin" && ctx.role !== "finance") {
      return c.json({ error: "insufficient_role" }, 403);
    }
    const syncAllowed = await checkConnectMutationRateLimit(
      container.redis,
      "sync",
      ctx.legalEntityId,
    );
    if (!syncAllowed) {
      return c.json({ error: "stripe_rate_limited" }, 429);
    }
    try {
      const status = await container.stripeConnectService.syncAccountFromStripe(ctx.legalEntityId);
      return c.json({ data: status });
    } catch (err) {
      const mapped = respondStripeConnectRouteError(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });

  r.post(
    "/account-session",
    requireAuth,
    requireContext,
    zValidator("json", sessionBodySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const body = c.req.valid("json");
      try {
        const session = await container.stripeConnectService.createAccountSession(
          ctx.legalEntityId,
          ctx.role,
          body.surface,
        );
        return c.json({ data: session });
      } catch (err) {
        const mapped = respondStripeConnectRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

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
      const ensureAllowed = await checkConnectMutationRateLimit(
        container.redis,
        "account",
        ctx.legalEntityId,
      );
      if (!ensureAllowed) {
        return c.json({ error: "stripe_rate_limited" }, 429);
      }
      const body = c.req.valid("json");
      try {
        const result = await container.stripeConnectService.ensureAccount(
          ctx.legalEntityId,
          body.country,
        );
        return c.json({ data: result }, 201);
      } catch (err) {
        const mapped = respondStripeConnectRouteError(c, err, {
          recordAccountCreateFailure: true,
        });
        if (mapped) return mapped;
        throw err;
      }
    },
  );

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
        const mapped = respondStripeConnectRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

  r.post("/dashboard-link", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    if (ctx.role !== "owner" && ctx.role !== "admin" && ctx.role !== "finance") {
      return c.json({ error: "insufficient_role" }, 403);
    }
    try {
      const link = await container.stripeConnectService.createDashboardLink(ctx.legalEntityId);
      return c.json({ data: link });
    } catch (err) {
      const mapped = respondStripeConnectRouteError(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });

  return r;
}
